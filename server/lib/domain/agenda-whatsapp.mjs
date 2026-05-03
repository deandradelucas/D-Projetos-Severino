import {
  atualizarAgendaEvento,
  atualizarAgendaStatus,
  criarAgendaEvento,
  formatAgendaDateTime,
  listarAgendaEventos,
  registrarInteracaoAgendaWhatsApp,
  AGENDA_TZ,
} from './agenda.mjs'

const AGENDA_RE =
  /\b(agenda|compromisso|compromissos|reuni[aã]o|reuniao|evento|consulta|agendar|marcar|cancelar|reagendar|remarcar|confirmar|concluir|lembrete|avise|avisar)\b/i

const WEEKDAY_MAP = new Map([
  ['domingo', 0],
  ['segunda', 1],
  ['terça', 2],
  ['terca', 2],
  ['quarta', 3],
  ['quinta', 4],
  ['sexta', 5],
  ['sábado', 6],
  ['sabado', 6],
])

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function addDays(base, days) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function nextWeekday(targetDay) {
  const d = startOfToday()
  const current = d.getDay()
  let delta = targetDay - current
  if (delta <= 0) delta += 7
  return addDays(d, delta)
}

function parseTime(message) {
  const text = String(message || '').toLowerCase()
  const match = text.match(/\b(?:as|às|a)\s*(\d{1,2})(?:[:h](\d{2}))?\b|\b(\d{1,2})h(\d{2})?\b/i)
  if (!match) return null
  const hour = Number.parseInt(match[1] || match[3], 10)
  const minute = Number.parseInt(match[2] || match[4] || '0', 10)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

export function parseAgendaDateTime(message, base = new Date()) {
  const raw = String(message || '')
  const text = stripAccents(raw.toLowerCase())
  const time = parseTime(text)
  if (!time) return null

  let date = new Date(base)
  date.setSeconds(0, 0)

  const explicitDate = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (explicitDate) {
    const day = Number.parseInt(explicitDate[1], 10)
    const month = Number.parseInt(explicitDate[2], 10)
    let year = explicitDate[3] ? Number.parseInt(explicitDate[3], 10) : date.getFullYear()
    if (year < 100) year += 2000
    date = new Date(year, month - 1, day)
  } else if (text.includes('depois de amanha')) {
    date = addDays(startOfToday(), 2)
  } else if (text.includes('amanha')) {
    date = addDays(startOfToday(), 1)
  } else {
    for (const [name, weekday] of WEEKDAY_MAP.entries()) {
      if (text.includes(name)) {
        date = nextWeekday(weekday)
        break
      }
    }
  }

  date.setHours(time.hour, time.minute, 0, 0)
  return date
}

function parseReminderMinutes(message) {
  const text = stripAccents(String(message || '').toLowerCase())
  const match = text.match(/\b(?:avise|avisar|lembre|lembrete).*?(\d{1,4})\s*(min|minutos|hora|horas|h)\b/)
  if (!match) return null
  const n = Number.parseInt(match[1], 10)
  if (!Number.isFinite(n)) return null
  const unit = match[2]
  return Math.min(unit.startsWith('h') || unit.startsWith('hora') ? n * 60 : n, 1440)
}

function extractTitle(message) {
  let text = String(message || '').trim()
  text = text.replace(/^(marcar|agendar|criar|adicionar)\s+(um|uma|o|a)?\s*/i, '')
  text = text.replace(/\b(hoje|amanh[aã]|depois de amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b.*$/i, '')
  text = text.replace(/\b(dia\s+)?\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?.*$/i, '')
  text = text.replace(/\b(?:as|às|a)\s*\d{1,2}([:h]\d{2})?\b.*$/i, '')
  const title = text.trim().replace(/\s+/g, ' ')
  return title.length >= 2 ? title.slice(0, 160) : 'Compromisso'
}

function formatLista(eventos, titulo = 'Agenda') {
  if (!eventos.length) return `🗓️ *${titulo}*\n\nNenhum compromisso encontrado.`
  const lines = eventos.slice(0, 8).map((ev, idx) => {
    const codigo = ev.id.slice(0, 8)
    const local = ev.local ? `\n   📍 ${ev.local}` : ''
    return `${idx + 1}. *${ev.titulo}*\n   ${formatAgendaDateTime(ev.inicio, ev.timezone || AGENDA_TZ)}\n   Código: ${codigo}${local}`
  })
  return `🗓️ *${titulo}*\n\n${lines.join('\n\n')}\n\nComandos: *confirmar 1*, *reagendar 1 para amanhã 10h*, *cancelar 1*.`
}

async function listarProximos(usuarioId, onlyToday = false) {
  const from = onlyToday ? startOfToday() : new Date()
  const to = onlyToday ? endOfToday() : addDays(new Date(), 30)
  return listarAgendaEventos(usuarioId, { from: from.toISOString(), to: to.toISOString() })
}

async function resolveEvento(usuarioId, token) {
  const eventos = await listarProximos(usuarioId, false)
  const raw = String(token || '').trim().toLowerCase()
  const index = Number.parseInt(raw, 10)
  if (Number.isFinite(index) && index >= 1 && index <= eventos.length) {
    return eventos[index - 1]
  }
  return eventos.find((ev) => ev.id.toLowerCase().startsWith(raw))
}

function targetToken(message, verbs) {
  const re = new RegExp(`\\b(?:${verbs})\\s+([a-f0-9-]{4,36}|\\d+)`, 'i')
  return String(message || '').match(re)?.[1]
}

export function isAgendaMessage(message) {
  return AGENDA_RE.test(String(message || ''))
}

export async function processarMensagemAgenda(usuario, phone, rawMessage) {
  const message = String(rawMessage || '').trim()
  if (!isAgendaMessage(message)) return null

  let reply = ''
  let intent = 'agenda_chat'
  let ok = true

  try {
    const text = stripAccents(message.toLowerCase())

    if (/\b(minha agenda|agenda hoje|compromissos hoje|hoje)\b/.test(text) && !/\b(marcar|agendar|criar|adicionar)\b/.test(text)) {
      intent = 'agenda_list_today'
      reply = formatLista(await listarProximos(usuario.id, true), 'Agenda de hoje')
      return { ok: true, reply }
    }

    if (/\b(proximos|próximos|minha agenda|agenda|compromissos)\b/.test(message) && !/\b(marcar|agendar|criar|adicionar)\b/i.test(message)) {
      intent = 'agenda_list'
      reply = formatLista(await listarProximos(usuario.id, false), 'Próximos compromissos')
      return { ok: true, reply }
    }

    const cancelToken = targetToken(message, 'cancelar|desmarcar')
    if (cancelToken) {
      intent = 'agenda_cancel'
      const evento = await resolveEvento(usuario.id, cancelToken)
      if (!evento) throw new Error('Não encontrei esse compromisso.')
      await atualizarAgendaStatus(evento.id, usuario.id, 'CANCELADO')
      reply = `🗓️ Compromisso cancelado: *${evento.titulo}*.`
      return { ok: true, reply }
    }

    const confirmToken = targetToken(message, 'confirmar')
    if (confirmToken) {
      intent = 'agenda_confirm'
      const evento = await resolveEvento(usuario.id, confirmToken)
      if (!evento) throw new Error('Não encontrei esse compromisso.')
      await atualizarAgendaStatus(evento.id, usuario.id, 'CONFIRMADO')
      reply = `✅ Confirmado: *${evento.titulo}* em ${formatAgendaDateTime(evento.inicio, evento.timezone || AGENDA_TZ)}.`
      return { ok: true, reply }
    }

    const doneToken = targetToken(message, 'concluir|finalizar')
    if (doneToken) {
      intent = 'agenda_done'
      const evento = await resolveEvento(usuario.id, doneToken)
      if (!evento) throw new Error('Não encontrei esse compromisso.')
      await atualizarAgendaStatus(evento.id, usuario.id, 'CONCLUIDO')
      reply = `🏁 Concluído: *${evento.titulo}*.`
      return { ok: true, reply }
    }

    const rescheduleToken = targetToken(message, 'reagendar|remarcar')
    if (rescheduleToken) {
      intent = 'agenda_reschedule'
      const evento = await resolveEvento(usuario.id, rescheduleToken)
      if (!evento) throw new Error('Não encontrei esse compromisso.')
      const inicio = parseAgendaDateTime(message)
      if (!inicio) throw new Error('Me diga a nova data e horário. Ex.: reagendar 1 para amanhã 10h.')
      const data = await atualizarAgendaEvento(evento.id, usuario.id, { inicio: inicio.toISOString(), status: 'AGENDADO' })
      reply = `🔁 Reagendado: *${data.titulo}* para ${formatAgendaDateTime(data.inicio, data.timezone || AGENDA_TZ)}.`
      return { ok: true, reply }
    }

    const reminderMinutes = parseReminderMinutes(message)
    if (reminderMinutes !== null) {
      intent = 'agenda_reminder_config'
      const rawToken = targetToken(message, 'avise|avisar|lembre|lembrete')
      const token = rawToken === String(reminderMinutes) ? '1' : rawToken || '1'
      const evento = await resolveEvento(usuario.id, token)
      if (!evento) throw new Error('Não encontrei compromisso para configurar o lembrete.')
      await atualizarAgendaEvento(evento.id, usuario.id, {
        lembrar_minutos_antes: reminderMinutes,
        whatsapp_notificar: true,
      })
      reply = `⏰ Combinado. Vou avisar *${reminderMinutes} min antes* de ${evento.titulo}.`
      return { ok: true, reply }
    }

    if (/\b(marcar|agendar|criar|adicionar)\b/.test(text)) {
      intent = 'agenda_create'
      const inicio = parseAgendaDateTime(message)
      if (!inicio) {
        reply = '🗓️ Para criar na agenda, envie algo como: *marcar reunião amanhã às 15h*.'
        return { ok: true, reply }
      }
      const minutos = parseReminderMinutes(message) ?? 15
      const data = await criarAgendaEvento(
        usuario.id,
        {
          titulo: extractTitle(message),
          inicio: inicio.toISOString(),
          lembrar_minutos_antes: minutos,
          whatsapp_notificar: true,
        },
        'WHATSAPP'
      )
      reply = `✅ Compromisso criado!\n\n*${data.titulo}*\n${formatAgendaDateTime(data.inicio, data.timezone || AGENDA_TZ)}\n⏰ Aviso: ${data.lembrar_minutos_antes} min antes\nCódigo: ${data.id.slice(0, 8)}`
      return { ok: true, reply }
    }

    reply = '🗓️ Posso ajudar com sua agenda. Ex.: *agenda hoje*, *marcar reunião amanhã 15h*, *confirmar 1*, *cancelar 1*.'
    return { ok: true, reply }
  } catch (error) {
    ok = false
    reply = `⚠️ ${error.message || 'Não consegui mexer na agenda agora.'}`
    return { ok: false, reply }
  } finally {
    await registrarInteracaoAgendaWhatsApp({
      usuarioId: usuario?.id,
      telefone: phone,
      mensagem: message,
      intencao: intent,
      resposta: reply,
      ok,
    })
  }
}

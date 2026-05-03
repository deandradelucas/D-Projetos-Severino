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

const SAO_PAULO_OFFSET = '-03:00'

function pad2(value) {
  return String(value).padStart(2, '0')
}

function saoPauloParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AGENDA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  const key = `${get('year')}-${get('month')}-${get('day')}`
  const weekdayName = String(get('weekday') || '').toLowerCase()
  const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(weekdayName.slice(0, 3))
  return {
    year: Number.parseInt(get('year'), 10),
    month: Number.parseInt(get('month'), 10),
    day: Number.parseInt(get('day'), 10),
    key,
    weekday: weekday >= 0 ? weekday : new Date(`${key}T00:00:00${SAO_PAULO_OFFSET}`).getUTCDay(),
  }
}

function saoPauloDateFromParts({ year, month, day, hour = 0, minute = 0 }) {
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00${SAO_PAULO_OFFSET}`)
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function startOfToday() {
  const parts = saoPauloParts()
  return saoPauloDateFromParts(parts)
}

function endOfToday() {
  const parts = saoPauloParts()
  const d = saoPauloDateFromParts({ ...parts, hour: 23, minute: 59 })
  d.setUTCSeconds(59, 999)
  return d
}

function addDays(base, days) {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function nextWeekday(targetDay) {
  const d = startOfToday()
  const current = saoPauloParts(d).weekday
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

  let parts = saoPauloParts(base)

  const explicitDate = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (explicitDate) {
    const day = Number.parseInt(explicitDate[1], 10)
    const month = Number.parseInt(explicitDate[2], 10)
    let year = explicitDate[3] ? Number.parseInt(explicitDate[3], 10) : parts.year
    if (year < 100) year += 2000
    parts = { year, month, day }
  } else if (text.includes('depois de amanha')) {
    parts = saoPauloParts(addDays(startOfToday(), 2))
  } else if (text.includes('amanha')) {
    parts = saoPauloParts(addDays(startOfToday(), 1))
  } else {
    for (const [name, weekday] of WEEKDAY_MAP.entries()) {
      if (text.includes(name)) {
        parts = saoPauloParts(nextWeekday(weekday))
        break
      }
    }
  }

  return saoPauloDateFromParts({ ...parts, hour: time.hour, minute: time.minute })
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

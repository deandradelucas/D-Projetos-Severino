import {
  atualizarAgendaEvento,
  atualizarAgendaStatus,
  criarAgendaEvento,
  formatAgendaDateTime,
  listarAgendaEventos,
  registrarInteracaoAgendaWhatsApp,
  ultimoEventoAgendaCriadoRecentemente,
  AGENDA_TZ,
} from './agenda.mjs'

const AGENDA_KEYWORD_RE =
  /\b(agenda|compromisso|compromissos|reuni[aã]o|reuniao|evento|consulta|consult[óo]rio|dentista|m[eé]dico|agendar|marcar|anotar|anota|cancelar|desmarcar|reagendar|remarcar|confirmar|concluir|finalizar|lembrete|lembra|lembrar|lembre|avise|avisar|alerte|alerta|alertar)\b/i
const CREATE_INTENT_RE =
  /\b(marcar|agendar|criar|adicionar|anotar|anota|colocar|inclui|incluir|tenho|terei|lembrete|lembra|lembrar|lembre|avise|avisar|alerte|alerta|alertar|consulta|reuni[aã]o|reuniao|evento|compromisso|dentista|m[eé]dico)\b/i

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
  const match = text.match(
    /\b(?:as|às|a|para|pelas?)\s*(\d{1,2})(?:[:h](\d{2}))?\b|\b(\d{1,2})[:h](\d{2})\b|\b(\d{1,2})h\b/i
  )
  if (!match) return null
  let hour = Number.parseInt(match[1] || match[3] || match[5], 10)
  const minute = Number.parseInt(match[2] || match[4] || '0', 10)
  if (hour >= 1 && hour <= 11 && /\b(da|de)?\s*(tarde|noite)\b/.test(text)) hour += 12
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

export function parseAgendaDateTime(message, base = new Date()) {
  const raw = String(message || '')
  const text = stripAccents(raw.toLowerCase())
  const time = parseTime(text)

  const relative = text.match(/\b(?:daqui\s+a|em)\s+(\d{1,3})\s*(min|minuto|minutos|hora|horas|h|dia|dias|semana|semanas)\b/)
  if (relative) {
    const amount = Number.parseInt(relative[1], 10)
    const unit = relative[2]
    if (!Number.isFinite(amount)) return null
    const d = new Date(base)
    if (unit.startsWith('min')) d.setUTCMinutes(d.getUTCMinutes() + amount)
    else if (unit.startsWith('h') || unit.startsWith('hora')) d.setUTCHours(d.getUTCHours() + amount)
    else if (unit.startsWith('dia')) d.setUTCDate(d.getUTCDate() + amount)
    else if (unit.startsWith('semana')) d.setUTCDate(d.getUTCDate() + amount * 7)
    return d
  }

  if (!time) return null

  let parts = saoPauloParts(base)
  /** Só horário no texto → assume calendário “hoje” em SP; se esse instante já passou, usa o dia seguinte. */
  let bumpDayIfPast = true

  const explicitDate = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (explicitDate) {
    bumpDayIfPast = false
    const day = Number.parseInt(explicitDate[1], 10)
    const month = Number.parseInt(explicitDate[2], 10)
    let year = explicitDate[3] ? Number.parseInt(explicitDate[3], 10) : parts.year
    if (year < 100) year += 2000
    parts = { year, month, day }
  } else if (text.includes('depois de amanha')) {
    bumpDayIfPast = false
    parts = saoPauloParts(addDays(startOfToday(), 2))
  } else if (text.includes('amanha')) {
    bumpDayIfPast = false
    parts = saoPauloParts(addDays(startOfToday(), 1))
  } else {
    let weekdayMatched = false
    for (const [name, weekday] of WEEKDAY_MAP.entries()) {
      if (text.includes(name)) {
        parts = saoPauloParts(nextWeekday(weekday))
        weekdayMatched = true
        break
      }
    }
    if (weekdayMatched) bumpDayIfPast = false
  }

  let result = saoPauloDateFromParts({ ...parts, hour: time.hour, minute: time.minute })
  if (bumpDayIfPast && result.getTime() < base.getTime()) {
    result = addDays(result, 1)
  }
  return result
}

/** Indica que "… para/as HH horas antes …" é horário (às HH), não pedido de aviso "HH horas antes". */
function isLikelyClockAtPhraseBeforeHourOffset(before) {
  const b = String(before || '').trimEnd()
  return (
    /\bpara\s+as\s*$/i.test(b) ||
    /\breuni[aã]o\s+para\s+as\s*$/i.test(b) ||
    /\breuniao\s+para\s+as\s*$/i.test(b) ||
    /\breuni[aã]o\s+as\s*$/i.test(b) ||
    /\breuniao\s+as\s*$/i.test(b) ||
    /\b(?:marcar|agendar|criar|anotar|tenho|terei)\s+\S+(?:\s+\S+)*\s+as\s*$/i.test(b)
  )
}

export function parseReminderMinutes(message) {
  const text = stripAccents(String(message || '').toLowerCase())
  const match = text.match(
    /\b(?:avise|avisar|alerte|alerta|alertar|lembre|lembrar|lembra|lembrete).*?(\d{1,4})\s*(min|minuto|minutos|hora|horas|h)\s+antes\b|\b(\d{1,4})\s*(min|minuto|minutos|hora|horas|h)\s+antes\b/
  )
  if (!match || match.index === undefined) return null
  const n = Number.parseInt(match[1] || match[3], 10)
  if (!Number.isFinite(n)) return null
  const unit = match[2] || match[4]
  const isHourUnit = unit.startsWith('h') || unit.startsWith('hora')
  if (isHourUnit && isLikelyClockAtPhraseBeforeHourOffset(text.slice(0, match.index))) return null
  return Math.min(unit.startsWith('h') || unit.startsWith('hora') ? n * 60 : n, 1440)
}

function extractTitle(message) {
  let text = String(message || '').trim()
  text = text.replace(/^(me\s+)?(marcar|agendar|criar|adicionar|anotar|anota|colocar|inclui|incluir|avise|avisar|alerte|alerta|alertar|lembra|lembrar|lembre|tenho|terei)\s+(de|para|um|uma|o|a)?\s*/i, '')
  text = text.replace(/^(um|uma|o|a)\s+(compromisso|lembrete|evento)\s+(de|para)?\s*/i, '')
  text = text.replace(/\b(me\s+)?(avise|avisar|alerte|alerta|alertar|lembre|lembrar|lembra)\b.*$/i, '')
  text = text.replace(/\b(hoje|amanh[aã]|depois de amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b.*$/i, '')
  text = text.replace(/\b(?:daqui\s+a|em)\s+\d{1,3}\s*(min|minuto|minutos|hora|horas|h|dia|dias|semana|semanas)\b.*$/i, '')
  text = text.replace(/\b(dia\s+)?\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?.*$/i, '')
  text = text.replace(/\b(?:as|às|a|para|pelas?)\s*\d{1,2}([:h]\d{2})?\b.*$/i, '')
  text = text.replace(/\b\d{1,2}[:h]\d{2}\b.*$/i, '')
  const title = text.trim().replace(/\s+/g, ' ')
  return title.length >= 2 ? title.slice(0, 160) : 'Compromisso'
}

function isReminderCreateMessage(message) {
  return /\b(me\s+)?(lembra|lembrar|lembre|avise|avisar|alerte|alerta|alertar|lembrete)\b/i.test(String(message || ''))
}

function titleForCreate(message) {
  const title = extractTitle(message)
  if (!isReminderCreateMessage(message)) return title
  if (/^(compromisso|quando for|quando der|na hora)$/i.test(title)) return 'Notificação'
  return title
}

function hasCreateIntent(message) {
  const text = String(message || '')
  return CREATE_INTENT_RE.test(text) || /\b(me\s+)?(lembra|avise|alerte)\s+de\b/i.test(text)
}

function formatReminderLabel(minutes) {
  const n = Number.parseInt(String(minutes ?? 0), 10)
  if (!Number.isFinite(n) || n <= 0) return 'na hora marcada'
  if (n % 60 === 0) {
    const horas = n / 60
    return `${horas} ${horas === 1 ? 'hora' : 'horas'} antes`
  }
  return `${n} min antes`
}

/** Opções do select no app web (minutos antes). */
const REMINDER_OPTIONS_APP = [0, 5, 10, 15, 30, 60]

/**
 * Aproxima minutos pedidos para o valor mais próximo permitido no formulário da agenda (web).
 */
export function snapReminderToAppOptions(minutes) {
  const n = Number.parseInt(String(minutes ?? 15), 10)
  if (!Number.isFinite(n)) return 15
  const clamped = Math.min(Math.max(n, 0), 1440)
  return REMINDER_OPTIONS_APP.reduce(
    (best, v) => (Math.abs(v - clamped) < Math.abs(best - clamped) ? v : best),
    15,
  )
}

/**
 * Rascunho para o modal da agenda (app) ou fallback quando a IA falha.
 * Reutiliza o mesmo interpretador de data/hora do WhatsApp.
 */
export function draftAgendaFromTextHeuristic(message, base = new Date()) {
  const inicio = parseAgendaDateTime(message, base)
  if (!inicio) return null
  const titulo = titleForCreate(message)
  const remFromText = parseReminderMinutes(message)
  const lembrar_minutos_antes = snapReminderToAppOptions(remFromText ?? 15)
  const reminderCreate = isReminderCreateMessage(message)
  return {
    titulo,
    descricao: reminderCreate ? '' : '',
    local: '',
    inicio: inicio.toISOString(),
    lembrar_minutos_antes,
    whatsapp_notificar: true,
    origem: 'heuristica',
  }
}

function formatLista(eventos, titulo = 'Agenda') {
  if (!eventos.length) return `🗓️ *${titulo}*\n\nNenhum compromisso encontrado.`
  const lines = eventos.slice(0, 8).map((ev, idx) => {
    const local = ev.local ? `\n   📍 ${ev.local}` : ''
    return `${idx + 1}. *${ev.titulo}*\n   ${formatAgendaDateTime(ev.inicio, ev.timezone || AGENDA_TZ)}${local}`
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
  const raw = String(message || '')
  const trimmed = raw.trim()
  if (/^[1-5]$/.test(trimmed)) return true
  if (/^aviso[1-5]$/i.test(trimmed)) return true
  if (AGENDA_KEYWORD_RE.test(raw)) return true
  return hasCreateIntent(raw) && Boolean(parseAgendaDateTime(raw))
}

export async function processarMensagemAgenda(usuario, phone, rawMessage) {
  const message = String(rawMessage || '').trim()
  if (!isAgendaMessage(message)) return null

  let reply = ''
  let intent = 'agenda_chat'
  let ok = true

  try {
    const trimmedMsg = message.trim()
    const menuDigit =
      trimmedMsg.match(/^([1-5])$/)?.[1] ?? trimmedMsg.match(/^aviso([1-5])$/i)?.[1]
    if (menuDigit) {
      intent = 'agenda_reminder_menu'
      const minutesMap = { '1': 0, '2': 5, '3': 10, '4': 30, '5': 60 }
      const minutes = minutesMap[menuDigit]
      const recent = await ultimoEventoAgendaCriadoRecentemente(usuario.id, 30)
      if (!recent) {
        reply =
          'Responda com *1* a *5* logo após criar o compromisso (ex.: marcar reunião amanhã 15h, depois envie *4* para 30 min antes).'
        return { ok: true, reply }
      }
      const updated = await atualizarAgendaEvento(recent.id, usuario.id, {
        lembrar_minutos_antes: minutes,
        whatsapp_notificar: true,
      })
      reply = `⏰ Definido: aviso *${formatReminderLabel(minutes)}* antes de *${updated.titulo}*.\n🗓️ ${formatAgendaDateTime(updated.inicio, updated.timezone || AGENDA_TZ)}`
      return { ok: true, reply }
    }

    const text = stripAccents(message.toLowerCase())

    const createIntent = hasCreateIntent(message)
    const inicioParaCriar = parseAgendaDateTime(message)

    if (/\b(minha agenda|agenda hoje|compromissos hoje|hoje)\b/.test(text) && !createIntent) {
      intent = 'agenda_list_today'
      reply = formatLista(await listarProximos(usuario.id, true), 'Agenda de hoje')
      return { ok: true, reply }
    }

    if (/\b(proximos|próximos|minha agenda|agenda|compromissos)\b/.test(message) && !createIntent) {
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

    if (createIntent) {
      intent = 'agenda_create'
      const inicio = inicioParaCriar
      if (!inicio) {
        reply = '🗓️ Para criar na agenda, envie algo como: *marcar reunião amanhã às 15h* ou *me lembra de pagar a luz sexta 9h*.'
        return { ok: true, reply }
      }
      const explicitReminder = parseReminderMinutes(message)
      const reminderCreate = isReminderCreateMessage(message)
      const data = await criarAgendaEvento(usuario.id, {
        titulo: titleForCreate(message),
        descricao: reminderCreate ? 'Notificação criada pelo WhatsApp.' : undefined,
        inicio: inicio.toISOString(),
        lembrar_minutos_antes: explicitReminder !== null ? explicitReminder : 15,
        whatsapp_notificar: true,
      })

      if (explicitReminder !== null) {
        reply = `✅ ${reminderCreate ? 'Notificação criada!' : 'Compromisso criado!'}\n\n*${data.titulo}*\n${formatAgendaDateTime(data.inicio, data.timezone || AGENDA_TZ)}\n⏰ Aviso: ${formatReminderLabel(data.lembrar_minutos_antes)}`
        return { ok: true, reply }
      }

      const quando = formatAgendaDateTime(data.inicio, data.timezone || AGENDA_TZ)
      reply = `✅ ${reminderCreate ? 'Notificação criada!' : 'Compromisso criado!'}\n*${data.titulo}*\n${quando}\n\nPara o aviso, responda só com *um* número:\n*1* — na hora\n*2* — 5 min antes\n*3* — 10 min antes\n*4* — 30 min antes\n*5* — 1 hora antes`
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

    reply = '🗓️ Posso ajudar com sua agenda. Ex.: *agenda hoje*, *marcar reunião amanhã 15h*, *me lembra de pagar a luz sexta 9h*, *confirmar 1*, *cancelar 1*.'
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

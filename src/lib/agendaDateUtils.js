/**
 * Utilitários de data/timezone para a página de Agenda.
 * Todas as funções operam com America/Sao_Paulo como referência.
 * Extraído de Agenda.jsx para reduzir o tamanho do arquivo.
 */

export const AGENDA_TIME_ZONE = 'America/Sao_Paulo'
export const SAO_PAULO_OFFSET = '-03:00'

export function saoPauloParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AGENDA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

export function saoPauloDateKey(isoOrDate) {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  const parts = saoPauloParts(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = saoPauloParts(d)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function localToIso(value) {
  if (!value) return ''
  const normalized = value.length === 16 ? `${value}:00${SAO_PAULO_OFFSET}` : `${value}${SAO_PAULO_OFFSET}`
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

export function capitalizeDateLabel(value) {
  return value
    .replace('.', '')
    .replace(/(^|,\s*|\s+de\s+)(\p{L})/gu, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`)
}

export function formatDate(iso) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(iso))
  return capitalizeDateLabel(formatted)
}

export function formatTime(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatEventDatetime(evento) {
  if (!evento.inicio) return null
  const local = toDatetimeLocal(evento.inicio)
  if (!local) return null
  const [datePart, timePart] = local.split('T')
  const [, month, day] = datePart.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${day} ${months[parseInt(month, 10) - 1]} · ${timePart}`
}

export function formatReminderOffset(minutes) {
  const n = Number.parseInt(String(minutes ?? 0), 10)
  if (!Number.isFinite(n) || n <= 0) return 'Na hora'
  return `${n} min`
}

export function formatAgendaListReminderMeta(evento, kind) {
  if (evento.whatsapp_notificar === false) return null
  if (kind === 'reminder') {
    return `Aviso de notificação às ${formatTime(evento.inicio)}`
  }
  const offset = formatReminderOffset(evento.lembrar_minutos_antes)
  return offset === 'Na hora' ? 'Lembrete na hora' : `Lembrete ${offset} antes`
}

export function plural(count, singular, pluralText) {
  return `${count} ${count === 1 ? singular : pluralText}`
}

export function isToday(iso) {
  return saoPauloDateKey(iso) === saoPauloDateKey(new Date())
}

export function eventTone(status) {
  if (status === 'CONFIRMADO') return 'confirmed'
  if (status === 'CONCLUIDO') return 'done'
  if (status === 'CANCELADO') return 'cancelled'
  return 'scheduled'
}

export function dateKeyToDate(dateKey) {
  return new Date(`${dateKey}T12:00:00${SAO_PAULO_OFFSET}`)
}

export function dateKeyToMonthKey(dateKey) {
  return dateKey.slice(0, 7)
}

export function monthKeyToDate(monthKey) {
  return new Date(`${monthKey}-01T12:00:00${SAO_PAULO_OFFSET}`)
}

export function addMonths(monthKey, amount) {
  const date = monthKeyToDate(monthKey)
  date.setMonth(date.getMonth() + amount)
  return saoPauloDateKey(date).slice(0, 7)
}

export function formatMonthTitle(monthKey) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  }).format(monthKeyToDate(monthKey))
  return capitalizeDateLabel(formatted)
}

export function formatSelectedDayTitle(dateKey) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    day: '2-digit',
    month: 'long',
    weekday: 'long',
  }).format(dateKeyToDate(dateKey))
  return capitalizeDateLabel(formatted)
}

export function formatCompactDate(dateKey) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    day: '2-digit',
    month: 'long',
  }).format(dateKeyToDate(dateKey))
  return capitalizeDateLabel(formatted)
}

export function buildMonthCalendar(monthKey) {
  const first = monthKeyToDate(monthKey)
  const month = first.getMonth()
  const firstDay = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - firstDay)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = saoPauloDateKey(date)
    return {
      key,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
    }
  })
}

export function getWeekRange(dateKey) {
  const date = dateKeyToDate(dateKey)
  const start = new Date(date)
  const mondayOffset = (date.getDay() + 6) % 7
  start.setDate(date.getDate() - mondayOffset)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function isReminderEvent(evento) {
  const text = `${evento.titulo || ''} ${evento.descricao || ''}`.toLowerCase()
  return /\b(lembra|lembrete|avise|alerte|notifica[cç][aã]o|pagar|tomar|ligar|renovar|buscar|comprar)\b/.test(text)
    || /^(quando for|notifica[cç][aã]o)$/i.test(String(evento.titulo || '').trim())
}

export function isMilestoneEvent(evento) {
  const text = `${evento.titulo || ''} ${evento.descricao || ''}`.toLowerCase()
  return /\b(marco|milestone|entrega|prazo|vencimento)\b/.test(text)
}

export function agendaItemKind(evento) {
  if (evento.status === 'CONCLUIDO') return 'done'
  if (isReminderEvent(evento)) return 'reminder'
  if (isMilestoneEvent(evento)) return 'milestone'
  return 'event'
}

export const AGENDA_KIND_META = {
  event: { label: 'Compromisso', icon: 'calendar', tone: 'event' },
  reminder: { label: 'Notificação', icon: 'bell', tone: 'reminder' },
  milestone: { label: 'Marco', icon: 'flag', tone: 'milestone' },
  done: { label: 'Concluído', icon: 'check', tone: 'done' },
}

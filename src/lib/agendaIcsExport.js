/**
 * Exporta eventos da agenda para iCalendar (.ics) com alarmes (Calendário Apple / Google).
 * No iPhone é o método mais fiável para lembretes — as notificações Web no Safari são limitadas.
 */

const DONE = new Set(['concluido', 'cancelado', 'pago', 'recebido'])

/** @param {string} text */
export function icsEscapeText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/** @param {Date} d */
function formatUtcDateTime(d) {
  const p = (n) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear() +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    'T' +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds()) +
    'Z'
  )
}

/** @param {Date} d — data local meia-noite como “dia inteiro” no fuso do utilizador */
function formatLocalDateOnly(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** @param {string | undefined} reminder */
function reminderToTriggerLine(reminder) {
  const r = String(reminder || '30-min')
  if (r === 'agora') return 'TRIGGER;RELATED=START:PT0S'
  if (r === '15-min') return 'TRIGGER;RELATED=START:-PT15M'
  if (r === '30-min') return 'TRIGGER;RELATED=START:-PT30M'
  if (r === '1-hora') return 'TRIGGER;RELATED=START:-PT1H'
  if (r === '1-dia') return 'TRIGGER;RELATED=START:-P1D'
  return 'TRIGGER;RELATED=START:-PT30M'
}

/** @param {Record<string, unknown>} ev */
function eventToVevent(ev, nowMs) {
  const st = String(ev.status || '')
  if (DONE.has(st)) return ''

  const start = new Date(ev.startAt)
  const endRaw = ev.endAt ? new Date(ev.endAt) : new Date(start.getTime() + 60 * 60 * 1000)
  if (Number.isNaN(start.getTime())) return ''

  const horizonEnd = nowMs + 365 * 24 * 60 * 60 * 1000
  if (start.getTime() > horizonEnd || start.getTime() < nowMs - 60 * 60 * 1000) return ''

  const uidBase = String(ev.id || '').replace(/[^a-zA-Z0-9-]/g, '') || 'ev'
  const uid = `${uidBase}-${start.getTime()}@horizonte-financeiro.local`
  const title = icsEscapeText(String(ev.title || 'Evento').trim() || 'Evento')
  const descParts = []
  if (ev.description) descParts.push(String(ev.description))
  if (ev.type) descParts.push(`Tipo: ${ev.type}`)
  if (ev.location) descParts.push(`Local: ${ev.location}`)
  const description = icsEscapeText(descParts.join('\\n'))

  const lines = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${formatUtcDateTime(new Date())}`]

  if (ev.allDay === true) {
    const startLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endLocal = Number.isNaN(endRaw.getTime())
      ? startLocal
      : new Date(endRaw.getFullYear(), endRaw.getMonth(), endRaw.getDate())
    const lastDay = endLocal < startLocal ? startLocal : endLocal
    const exclusiveEnd = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1)
    lines.push(`DTSTART;VALUE=DATE:${formatLocalDateOnly(startLocal)}`)
    lines.push(`DTEND;VALUE=DATE:${formatLocalDateOnly(exclusiveEnd)}`)
  } else {
    lines.push(`DTSTART:${formatUtcDateTime(start)}`)
    lines.push(`DTEND:${formatUtcDateTime(Number.isNaN(endRaw.getTime()) ? start : endRaw)}`)
  }

  lines.push(`SUMMARY:${title}`)
  if (description) lines.push(`DESCRIPTION:${description}`)
  lines.push('BEGIN:VALARM')
  lines.push(reminderToTriggerLine(/** @type {string} */ (ev.reminder)))
  lines.push('ACTION:DISPLAY')
  lines.push(`DESCRIPTION:${title}`)
  lines.push('END:VALARM')
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

/**
 * @param {Record<string, unknown>[]} events
 * @param {{ nowMs?: number }} [opts]
 */
export function buildAgendaIcs(events, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now()
  const parts = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Horizonte Financeiro//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  if (!Array.isArray(events)) {
    parts.push('END:VCALENDAR')
    return parts.join('\r\n')
  }

  for (const ev of events) {
    const block = eventToVevent(ev, nowMs)
    if (block) parts.push(block)
  }
  parts.push('END:VCALENDAR')
  return parts.join('\r\n')
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Tenta partilhar para a app Calendário (iOS); senão descarrega .ics.
 * @param {Record<string, unknown>[]} events
 * @returns {Promise<'shared' | 'downloaded' | 'aborted' | 'empty'>}
 */
export async function shareOrDownloadAgendaIcs(events) {
  const ics = buildAgendaIcs(events)
  if (!ics.includes('BEGIN:VEVENT')) {
    return 'empty'
  }
  const filename = 'horizonte-agenda.ics'
  const mime = 'text/calendar;charset=utf-8'

  try {
    const file = new File([ics], filename, { type: mime })
    if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
      const payload = { files: [file], title: 'Agenda Horizonte', text: 'Lembretes da sua agenda' }
      if (navigator.canShare(payload)) {
        await navigator.share(payload)
        return 'shared'
      }
    }
  } catch (e) {
    if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') {
      return 'aborted'
    }
  }

  downloadBlob(new Blob([ics], { type: mime }), filename)
  return 'downloaded'
}

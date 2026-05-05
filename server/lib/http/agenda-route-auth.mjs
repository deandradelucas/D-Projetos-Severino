import { log } from '../logger.mjs'

export function assertAgendaReminderSecret(c) {
  const expected = process.env.AGENDA_REMINDER_SECRET || process.env.WHATSAPP_BOT_SECRET
  if (!expected || String(expected).trim() === '') {
    log.warn('[agenda] AGENDA_REMINDER_SECRET/WHATSAPP_BOT_SECRET não configurado')
    return { ok: false, status: 503, message: 'Agenda WhatsApp não configurada.' }
  }
  const auth = c.req.header('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const header = c.req.header('x-agenda-reminder-secret') || ''
  if (bearer === expected || header === expected) return { ok: true }
  return { ok: false, status: 401, message: 'Não autorizado.' }
}

export function assertAgendaCronSecret(c) {
  const allowed = [
    process.env.CRON_SECRET,
    process.env.AGENDA_REMINDER_SECRET,
    process.env.WHATSAPP_BOT_SECRET,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  if (!allowed.length) {
    log.warn('[agenda-cron] nenhum segredo configurado')
    return { ok: false, status: 503, message: 'Cron de agenda não configurado.' }
  }

  const auth = c.req.header('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const headers = [bearer, c.req.header('x-cron-secret'), c.req.header('x-agenda-reminder-secret')]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  if (headers.some((value) => allowed.includes(value))) return { ok: true }

  return { ok: false, status: 401, message: 'Não autorizado.' }
}

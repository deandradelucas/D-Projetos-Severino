/**
 * Lembretes da agenda no dispositivo (Notifications API + service worker quando existir).
 * No iPhone o Safari não corre avisos em segundo plano como no Android — o fluxo fiável é exportar .ics
 * para a app Calendário (`agendaIcsExport.js` + UI na página Agenda).
 */

import { AGENDA_REMINDER_LABELS } from './agendaConstants'

const LS_ENABLED = 'horizonte_agenda_notifications_enabled'
const LS_FIRED = 'horizonte_agenda_notif_fired_v1'
const MAX_FIRED_KEYS = 400
const NOTIFY_WINDOW_MS = 120_000
const POLL_MS_VISIBLE = 45_000
const POLL_MS_HIDDEN = 120_000

const DONE = new Set(['concluido', 'cancelado', 'pago', 'recebido'])

/** @param {string | undefined} reminder */
export function reminderMinutesBefore(reminder) {
  const r = String(reminder || '30-min')
  if (r === 'agora') return 0
  if (r === '15-min') return 15
  if (r === '30-min') return 30
  if (r === '1-hora') return 60
  if (r === '1-dia') return 24 * 60
  return 30
}

export function notificationsSupported() {
  return typeof Notification !== 'undefined'
}

export function readAgendaNotificationsEnabled() {
  try {
    return localStorage.getItem(LS_ENABLED) === '1'
  } catch {
    return false
  }
}

export function writeAgendaNotificationsEnabled(on) {
  try {
    if (on) localStorage.setItem(LS_ENABLED, '1')
    else localStorage.removeItem(LS_ENABLED)
  } catch {
    /* ignore */
  }
}

function loadFiredSet() {
  try {
    const raw = localStorage.getItem(LS_FIRED)
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveFiredSet(set) {
  try {
    const arr = [...set].slice(-MAX_FIRED_KEYS)
    localStorage.setItem(LS_FIRED, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

/** @param {Record<string, unknown>} ev */
function shouldConsiderEvent(ev) {
  const st = String(ev.status || '')
  if (DONE.has(st)) return false
  const start = new Date(ev.startAt)
  if (Number.isNaN(start.getTime())) return false
  return true
}

function firedKey(ev) {
  return `${String(ev.id)}|${String(ev.startAt)}|${String(ev.reminder || '30-min')}`
}

/**
 * @param {string} title
 * @param {{ body?: string; tag?: string }} opts
 */
async function showDeviceNotification(title, opts = {}) {
  const icon = '/images/horizonte_fiel_original_icon_dark.png'
  const options = {
    body: opts.body,
    icon,
    badge: icon,
    tag: opts.tag || 'horizonte-agenda',
    vibrate: [80, 40, 80],
    silent: false,
  }
  try {
    if (navigator.serviceWorker?.ready) {
      const reg = await navigator.serviceWorker.ready
      if (typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options)
        return
      }
    }
  } catch {
    /* fallback */
  }
  if (typeof Notification === 'function' && Notification.permission === 'granted') {
    const n = new Notification(title, options)
    void n
  }
}

/** @param {Record<string, unknown>[]} events @param {Set<string>} fired */
export function scanAgendaEventsForNotifications(events, fired) {
  if (!Array.isArray(events) || Notification.permission !== 'granted') return fired

  const now = Date.now()
  let changed = false

  for (const ev of events) {
    if (!shouldConsiderEvent(ev)) continue

    const key = firedKey(ev)
    if (fired.has(key)) continue

    const startMs = new Date(ev.startAt).getTime()
    const offsetMin = reminderMinutesBefore(/** @type {string} */ (ev.reminder))
    const offsetMs = offsetMin * 60_000

    let notifyAtMs
    if (offsetMin === 0) {
      notifyAtMs = startMs
    } else {
      notifyAtMs = startMs - offsetMs
    }

    const inWindow = now >= notifyAtMs && now < notifyAtMs + NOTIFY_WINDOW_MS
    if (!inWindow) continue

    const reminderLabel = AGENDA_REMINDER_LABELS[ev.reminder] || AGENDA_REMINDER_LABELS['30-min']
    const when = new Date(ev.startAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    const title = String(ev.title || 'Evento na agenda').trim() || 'Evento na agenda'
    const body = `${when} · ${reminderLabel}`

    fired.add(key)
    changed = true
    void showDeviceNotification(title, { body, tag: key })
  }

  if (changed) saveFiredSet(fired)
  return fired
}

/**
 * @returns {Promise<'granted' | 'denied' | 'default' | 'unsupported'>}
 */
export async function requestAgendaNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  const cur = Notification.permission
  if (cur === 'granted' || cur === 'denied') return cur
  try {
    const r = await Notification.requestPermission()
    return r === 'granted' ? 'granted' : r === 'denied' ? 'denied' : 'default'
  } catch {
    return 'denied'
  }
}

/**
 * Inicia sondagem periódica enquanto a página estiver montada.
 * @param {() => Record<string, unknown>[]} getEvents
 * @returns {() => void} cleanup
 */
export function startAgendaNotificationScheduler(getEvents) {
  if (!readAgendaNotificationsEnabled() || Notification.permission !== 'granted') {
    return () => {}
  }

  const fired = loadFiredSet()

  const tick = () => {
    try {
      scanAgendaEventsForNotifications(getEvents() || [], fired)
    } catch {
      /* ignore */
    }
  }

  tick()
  let id = setInterval(tick, document.hidden ? POLL_MS_HIDDEN : POLL_MS_VISIBLE)

  const onVis = () => {
    clearInterval(id)
    id = setInterval(tick, document.hidden ? POLL_MS_HIDDEN : POLL_MS_VISIBLE)
    tick()
  }
  document.addEventListener('visibilitychange', onVis)

  return () => {
    clearInterval(id)
    document.removeEventListener('visibilitychange', onVis)
  }
}

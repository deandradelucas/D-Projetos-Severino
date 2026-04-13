/**
 * Lembretes da agenda no dispositivo (Notifications API + service worker quando existir).
 * No iPhone o Safari suspende a página em segundo plano: não há garantia de aviso com o app fechado
 * (use exportar .ics → Calendário, ou PWA no ecrã principal + permissão; lembretes Web push no servidor seria outro passo).
 */

import { AGENDA_REMINDER_LABELS } from './agendaConstants'
import { isIOSDevice } from './devicePlatform'

const LS_ENABLED = 'horizonte_agenda_notifications_enabled'
const LS_FIRED = 'horizonte_agenda_notif_fired_v1'
const MAX_FIRED_KEYS = 400
/** Após o horário do evento, lembrete "agora" ainda pode disparar nesta janela (ex.: abriu a app atrasado). */
const AT_START_GRACE_MS = 30 * 60_000
const POLL_MS_VISIBLE = 45_000
const POLL_MS_VISIBLE_IOS = 20_000
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
 * Janela útil do lembrete: após o instante calculado (ex.: 30 min antes) até ao início do evento.
 * A versão antiga só aceitava 2 min após esse instante — na prática quase ninguém recebia, e no iPhone (página suspensa) pior.
 * @param {number} now
 * @param {number} startMs
 * @param {number} notifyAtMs
 * @param {number} offsetMin
 */
export function isReminderNotifyWindow(now, startMs, notifyAtMs, offsetMin) {
  if (now < notifyAtMs) return false
  if (offsetMin === 0) {
    return now >= startMs && now < startMs + AT_START_GRACE_MS
  }
  return now < startMs
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
    silent: false,
  }
  if (!isIOSDevice()) {
    options.vibrate = [80, 40, 80]
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

    if (!isReminderNotifyWindow(now, startMs, notifyAtMs, offsetMin)) continue

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
 * No iPhone (PWA), o aviso via service worker só funciona com SW ativo; após permissão, força registo e espera.
 * Em `npm run dev` o SW está desligado por defeito (igual a `registerServiceWorker`).
 */
export async function ensureAgendaServiceWorkerReady() {
  if (!('serviceWorker' in navigator)) return false
  const forceDev = import.meta.env.VITE_ENABLE_SW === 'true'
  if (import.meta.env.DEV && !forceDev) return true
  try {
    await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    return true
  } catch {
    return false
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

  const pollVisible = () => (isIOSDevice() ? POLL_MS_VISIBLE_IOS : POLL_MS_VISIBLE)

  tick()
  let id = setInterval(tick, document.hidden ? POLL_MS_HIDDEN : pollVisible())

  const onVis = () => {
    clearInterval(id)
    id = setInterval(tick, document.hidden ? POLL_MS_HIDDEN : pollVisible())
    tick()
  }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('focus', onVis)
  window.addEventListener('pageshow', onVis)

  return () => {
    clearInterval(id)
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('focus', onVis)
    window.removeEventListener('pageshow', onVis)
  }
}

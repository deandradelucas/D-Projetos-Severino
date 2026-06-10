/* Access token: mantido apenas em memória (não persiste entre reloads — XSS não pode roubá-lo via localStorage).
 * Refresh token: vive em cookie HttpOnly setado pelo servidor (Story S1) — invisível ao JS.
 * As funções de localStorage abaixo existem só para MIGRAR tokens legados (sessões
 * de antes do cookie): lidos uma última vez no /refresh e então apagados. */

const REFRESH_STORAGE_KEY = 'horizonte_refresh_token'

let _accessToken = ''

export function readHorizonteAccessToken() {
  return _accessToken
}

export function writeHorizonteAccessToken(token) {
  _accessToken = String(token || '').trim()
}

export function clearHorizonteAccessToken() {
  _accessToken = ''
}

export function readHorizonteRefreshToken() {
  if (typeof window === 'undefined') return ''
  try {
    return String(window.localStorage.getItem(REFRESH_STORAGE_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function writeHorizonteRefreshToken(token) {
  if (typeof window === 'undefined') return
  try {
    const t = String(token || '').trim()
    if (t) window.localStorage.setItem(REFRESH_STORAGE_KEY, t)
    else window.localStorage.removeItem(REFRESH_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function clearHorizonteRefreshToken() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(REFRESH_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

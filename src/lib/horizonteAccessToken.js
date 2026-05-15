const STORAGE_KEY = 'horizonte_access_token'

export function readHorizonteAccessToken() {
  if (typeof window === 'undefined') return ''
  try {
    return String(window.localStorage.getItem(STORAGE_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function writeHorizonteAccessToken(token) {
  if (typeof window === 'undefined') return
  try {
    const t = String(token || '').trim()
    if (t) window.localStorage.setItem(STORAGE_KEY, t)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function clearHorizonteAccessToken() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

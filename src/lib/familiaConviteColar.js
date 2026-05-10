/** Convite conta familiar — colar link ou código (login/cadastro). */

export const FAMILIA_CONVITE_SESSION_KEY = 'severino_familia_convite'

/**
 * Extrai o token do texto colado: URL com ?convite=, fragmento com convite=, ou string inteira.
 * @param {string} raw
 * @returns {string}
 */
export function extrairTokenConviteFamilia(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''

  try {
    const u = /^https?:\/\//i.test(s) ? new URL(s) : new URL(s, 'https://convite.placeholder/')
    const q = u.searchParams.get('convite')
    if (q?.trim()) return q.trim()
  } catch {
    /* não é URL */
  }

  const m = s.match(/[?&#]convite=([^&\s#]+)/i)
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1].trim())
    } catch {
      return m[1].trim()
    }
  }

  return s
}

export function persistConviteTokenSession(token) {
  const t = String(token || '').trim()
  if (!t) return false
  try {
    window.sessionStorage.setItem(FAMILIA_CONVITE_SESSION_KEY, t)
    return true
  } catch {
    return false
  }
}

export function readConviteTokenSession() {
  try {
    return String(window.sessionStorage.getItem(FAMILIA_CONVITE_SESSION_KEY) || '').trim()
  } catch {
    return ''
  }
}

/**
 * Origem pública do app (scheme + host) para links partilháveis.
 * Em localhost o utilizador do convite deve abrir o ambiente real — não o dev server.
 */

const DEFAULT_CONVITE_ORIGIN = 'https://severino.mestredamente.com'

function normalizeOrigin(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return u.origin
  } catch {
    return ''
  }
}

/**
 * URL base para montar links de convite (e mensagem PWA).
 * - `VITE_PUBLIC_APP_ORIGIN` (opcional) sobrescreve tudo.
 * - Localhost / 127.0.0.1 → produção Severino.
 * - Caso contrário → `window.location.origin` (preview, outro domínio).
 */
export function getPublicAppOriginForConvites() {
  const fromEnv = normalizeOrigin(import.meta.env.VITE_PUBLIC_APP_ORIGIN)
  if (fromEnv) return fromEnv

  if (typeof window === 'undefined') return DEFAULT_CONVITE_ORIGIN

  const host = String(window.location.hostname || '').toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost')) {
    return DEFAULT_CONVITE_ORIGIN
  }

  return window.location.origin
}

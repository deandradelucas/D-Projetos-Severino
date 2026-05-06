/**
 * Monta a URL da API.
 * - Sem `VITE_API_URL`: em dev usa `/api` (proxy Vite). Em produção no front Severino
 *   (`severino.mestredamente.com` ou `www.severino.mestredamente.com`), usa API em
 *   `https://mestredamente.com` (ou `VITE_SEVERINO_API_ORIGIN`).
 * - **Hostinger:** não defina `VITE_API_URL` como o URL do próprio Severino — isso fazia o
 *   cliente usar `/api` no site estático e receber HTML (erro “resposta inválida”). Esse caso
 *   é ignorado e volta-se ao apex da API.
 * - **Vercel + domínio:** com `VITE_API_URL` explícito e origem ≠ API, sem `VITE_API_ABSOLUTE`,
 *   usa `/api` relativo (rewrites). Esse atalho **não** se aplica no host Severino.
 */
const SEVERINO_HOST_RE = /^(?:www\.)?severino\.mestredamente\.com$/i

function isSeverinoFrontendHost(hostname) {
  return typeof hostname === 'string' && SEVERINO_HOST_RE.test(hostname.trim())
}

function stripTrailingSlash(s) {
  return s.replace(/\/$/, '')
}

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const raw = import.meta.env.VITE_API_URL
  let envBase =
    raw === undefined || raw === null ? '' : String(raw).trim().replace(/\/$/, '')

  const severinoApiRaw = import.meta.env.VITE_SEVERINO_API_ORIGIN
  const defaultSeverinoApi = stripTrailingSlash(
    severinoApiRaw != null && String(severinoApiRaw).trim()
      ? String(severinoApiRaw).trim().replace(/\/$/, '')
      : 'https://mestredamente.com',
  )

  let inferredBase = ''
  if (
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.location?.hostname &&
    isSeverinoFrontendHost(window.location.hostname)
  ) {
    inferredBase = defaultSeverinoApi
  }

  // Env apontando para o próprio front Severino (só estático) — tratar como não definido
  if (
    envBase &&
    typeof window !== 'undefined' &&
    window.location?.origin &&
    isSeverinoFrontendHost(window.location.hostname)
  ) {
    try {
      const normalized = /^https?:\/\//i.test(envBase) ? envBase : `https://${envBase}`
      if (new URL(normalized).origin === window.location.origin) {
        envBase = ''
      }
    } catch {
      /* mantém envBase */
    }
  }

  const base = envBase || inferredBase
  const baseFromEnv = Boolean(envBase)

  const forceAbsolute =
    import.meta.env.VITE_API_ABSOLUTE === '1' || import.meta.env.VITE_API_ABSOLUTE === 'true'

  const onSeverinoHost =
    typeof window !== 'undefined' &&
    typeof window.location?.hostname === 'string' &&
    isSeverinoFrontendHost(window.location.hostname)

  if (
    baseFromEnv &&
    !forceAbsolute &&
    import.meta.env.PROD &&
    base &&
    typeof window !== 'undefined' &&
    window.location?.origin &&
    !onSeverinoHost
  ) {
    try {
      const normalized = /^https?:\/\//i.test(base) ? base : `https://${base}`
      const apiOrigin = new URL(normalized).origin
      if (apiOrigin !== window.location.origin) {
        return p
      }
    } catch {
      /* mantém base absoluta se URL inválida */
    }
  }

  return base ? `${base}${p}` : p
}

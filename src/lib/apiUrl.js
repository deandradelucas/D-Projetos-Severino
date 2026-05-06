/**
 * Monta a URL da API.
 * - Dev: `/api` (proxy Vite).
 * - Produção Severino (`severino.mestredamente.com`), uma destas:
 *   - **API na mesma origem:** VPS Hostinger com Nginx/OpenLiteSpeed a encaminhar `/api` → Node
 *     (ex. `server/index.mjs` na porta 3001). No build Git: `VITE_SEVERINO_SAME_ORIGIN_API=1`
 *     para usar `/api` relativo e não mostrar aviso de configuração.
 *   - **API noutro host/subdomínio:** `VITE_SEVERINO_API_ORIGIN` ou `VITE_API_URL` com URL absoluto.
 * - **Hostinger só Git estático** (sem proxy `/api`): não funciona — falta Node ou outro host da API.
 * - Subdomínio extra só para o **front** (ex.: `app.severino…`): lista em `VITE_SEVERINO_FRONT_HOST`.
 * - Subdomínio para a **API**: não uses esta lista — usa `VITE_SEVERINO_API_ORIGIN` no build do front.
 * - **Vercel:** `VITE_API_URL` + mesmo projeto usa `/api` relativo (rewrites); no host Severino não se aplica.
 */
const SEVERINO_HOST_RE = /^(?:www\.)?severino\.mestredamente\.com$/i

function extraSeverinoFrontHosts() {
  const raw = import.meta.env.VITE_SEVERINO_FRONT_HOST || ''
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function isSeverinoFrontendHost(hostname) {
  if (typeof hostname !== 'string') return false
  const h = hostname.trim().toLowerCase()
  if (SEVERINO_HOST_RE.test(h)) return true
  return extraSeverinoFrontHosts().includes(h)
}

function stripTrailingSlash(s) {
  return s.replace(/\/$/, '')
}

function severinoSameOriginApiFlag() {
  return (
    import.meta.env.VITE_SEVERINO_SAME_ORIGIN_API === '1' ||
    import.meta.env.VITE_SEVERINO_SAME_ORIGIN_API === 'true'
  )
}

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`

  /* Hostinger VPS: front estático + proxy reverso `/api` → Hono no mesmo domínio */
  if (
    severinoSameOriginApiFlag() &&
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.location?.hostname &&
    isSeverinoFrontendHost(window.location.hostname)
  ) {
    return p
  }

  const raw = import.meta.env.VITE_API_URL
  let envBase =
    raw === undefined || raw === null ? '' : String(raw).trim().replace(/\/$/, '')

  const severinoApiRaw = import.meta.env.VITE_SEVERINO_API_ORIGIN || import.meta.env.VITE_API_URL
  const defaultSeverinoApi = stripTrailingSlash(
    severinoApiRaw != null && String(severinoApiRaw).trim()
      ? String(severinoApiRaw).trim().replace(/\/$/, '')
      : '',
  )

  let inferredBase = ''
  if (
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.location?.hostname &&
    isSeverinoFrontendHost(window.location.hostname)
  ) {
    inferredBase = defaultSeverinoApi
    if (inferredBase && window.location?.origin) {
      try {
        const normalized = /^https?:\/\//i.test(inferredBase) ? inferredBase : `https://${inferredBase}`
        if (new URL(normalized).origin === window.location.origin) {
          inferredBase = ''
        }
      } catch {
        /* mantém */
      }
    }
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

/** Produção Severino sem URL da API nem modo “mesma origem” → `/api` pode ser só HTML estático. */
export function severinoProdApiMisconfigured() {
  if (!import.meta.env.PROD || typeof window === 'undefined') return false
  if (!isSeverinoFrontendHost(window.location.hostname)) return false
  if (severinoSameOriginApiFlag()) return false
  return apiUrl('/api/health').startsWith('/')
}

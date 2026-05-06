/**
 * Monta a URL da API.
 * - Sem `VITE_API_URL`: em dev usa `/api` (proxy Vite). Em produção no host
 *   `severino.mestredamente.com`, assume API em `https://mestredamente.com` (Hostinger estático
 *   + API no apex). Nos restantes hosts em produção continua `/api` no mesmo origin (ex.: Vercel).
 * - Com `VITE_API_URL`: base explícita (outro servidor ou override do caso Severino).
 *
 * **Vercel + domínio personalizado:** com `VITE_API_URL` definido e origem da página ≠ API,
 * sem `VITE_API_ABSOLUTE`, usa-se `/api` relativo ao mesmo host (rewrites → `api/index.js`).
 *
 * **API noutro domínio com env:** use `VITE_API_ABSOLUTE=1` se precisar de URL absoluta mesmo
 * tendo `VITE_API_URL` (ex.: front e API em hosts diferentes sem rewrites).
 */
const SEVERINO_HOST = 'severino.mestredamente.com'
const SEVERINO_API_ORIGIN = 'https://mestredamente.com'

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const raw = import.meta.env.VITE_API_URL
  const envBase =
    raw === undefined || raw === null ? '' : String(raw).trim().replace(/\/$/, '')

  let inferredBase = ''
  if (
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.location?.hostname === SEVERINO_HOST
  ) {
    inferredBase = SEVERINO_API_ORIGIN
  }

  const base = envBase || inferredBase
  const baseFromEnv = Boolean(envBase)

  const forceAbsolute =
    import.meta.env.VITE_API_ABSOLUTE === '1' || import.meta.env.VITE_API_ABSOLUTE === 'true'

  // Só “desvia” para /api relativo quando a base veio do env (caso Vercel); inferência Severino
  // usa sempre URL absoluta para não bater na Hostinger sem Node em /api.
  if (
    baseFromEnv &&
    !forceAbsolute &&
    import.meta.env.PROD &&
    base &&
    typeof window !== 'undefined' &&
    window.location?.origin
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

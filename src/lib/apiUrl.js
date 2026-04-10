/**
 * Monta a URL da API.
 * - Sem `VITE_API_URL`: usa caminho relativo `/api` (proxy do Vite em dev ou mesmo host em produção).
 * - Com `VITE_API_URL`: base absoluta (ex.: outro servidor).
 *
 * **Domínio personalizado (ex.: horizontefinanceiro.mestredamente.com):** se o build tiver
 * `VITE_API_URL` apontando para outro host (ex.: `*.vercel.app`), o browser faz requisição
 * cross-origin e pode falhar (CORS) ou não refletir o mesmo deploy. Em **produção**, quando
 * a origem da página ≠ origem de `VITE_API_URL`, usamos sempre URL **relativa** `/api` no
 * mesmo host (Vercel: mesmo projeto, rewrites para `api/index.js`). Assim os dados do
 * utilizador vêm sempre do backend ligado a esse domínio.
 *
 * Para API realmente noutro domínio em produção, defina `VITE_API_ABSOLUTE=1` no build e
 * inclua o domínio do front em `CORS_ORIGINS` no servidor.
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const raw = import.meta.env.VITE_API_URL
  const base =
    raw === undefined || raw === null ? '' : String(raw).trim().replace(/\/$/, '')

  const forceAbsolute =
    import.meta.env.VITE_API_ABSOLUTE === '1' || import.meta.env.VITE_API_ABSOLUTE === 'true'

  if (
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

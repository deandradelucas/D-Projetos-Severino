/**
 * Monta a URL da API.
 * - Sem `VITE_API_URL`: usa caminho relativo `/api` (proxy do Vite em dev ou mesmo host em produção).
 * - Com `VITE_API_URL`: útil quando o front está em outro domínio que o backend.
 */
export function apiUrl(path) {
  const raw = import.meta.env.VITE_API_URL
  const base =
    raw === undefined || raw === null ? '' : String(raw).trim().replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

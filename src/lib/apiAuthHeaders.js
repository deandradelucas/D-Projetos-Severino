import { readHorizonteAccessToken } from './horizonteAccessToken'

/** Cabeçalhos para chamadas autenticadas à API (JWT Bearer). */
export function horizonteApiAuthHeaders(extra = {}) {
  const headers = { ...extra }
  const t = readHorizonteAccessToken()
  if (t) headers.Authorization = `Bearer ${t}`
  return headers
}

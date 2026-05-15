import { readHorizonteAccessToken } from './horizonteAccessToken'
import { tryRefreshToken, forceLogout } from './authRefresh'

function authHeaders(extra = {}) {
  const headers = { ...extra }
  const t = readHorizonteAccessToken()
  if (t) headers.Authorization = `Bearer ${t}`
  return headers
}

/**
 * Wrapper sobre fetch que injeta Authorization e renova o token automaticamente em caso de 401.
 * Retry único após refresh bem-sucedido. Se o refresh falhar, redireciona para login.
 *
 * Uso: mesma assinatura do fetch nativo.
 *   const res = await apiFetch('/api/transacoes', { method: 'GET', ... })
 */
export async function apiFetch(input, init = {}) {
  const { headers: extraHeaders, ...rest } = init
  const headers = authHeaders(extraHeaders || {})

  let res = await fetch(input, { ...rest, headers })

  if (res.status === 401) {
    const refreshed = await tryRefreshToken()
    if (!refreshed) {
      forceLogout()
      // Retorna a resposta 401 original (o redirect já foi disparado)
      return res
    }
    // Retry com o novo access token
    const retryHeaders = authHeaders(extraHeaders || {})
    res = await fetch(input, { ...rest, headers: retryHeaders })

    // Se ainda 401 após refresh, sessão inválida — forçar logout
    if (res.status === 401) {
      forceLogout()
    }
  }

  return res
}

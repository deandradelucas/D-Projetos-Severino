import { apiUrl } from './apiUrl'
import {
  readHorizonteRefreshToken,
  writeHorizonteAccessToken,
  writeHorizonteRefreshToken,
  clearHorizonteAccessToken,
  clearHorizonteRefreshToken,
} from './horizonteAccessToken'

// Deduplicação: se já há um refresh em andamento, todos os callers aguardam o mesmo Promise.
let _inflightRefresh = null

/**
 * Tenta renovar o access token usando o refresh token armazenado.
 * Retorna true se bem-sucedido, false se sessão expirada (deve redirecionar para login).
 */
export async function tryRefreshToken() {
  if (_inflightRefresh) return _inflightRefresh

  _inflightRefresh = (async () => {
    try {
      const refreshToken = readHorizonteRefreshToken()
      if (!refreshToken) return false

      const res = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!res.ok) {
        clearHorizonteAccessToken()
        clearHorizonteRefreshToken()
        return false
      }

      const data = await res.json()
      if (!data.accessToken || !data.refreshToken) {
        clearHorizonteAccessToken()
        clearHorizonteRefreshToken()
        return false
      }

      writeHorizonteAccessToken(data.accessToken)
      writeHorizonteRefreshToken(data.refreshToken)
      window.dispatchEvent(new Event('horizonte-token-refreshed'))
      return true
    } catch {
      return false
    } finally {
      _inflightRefresh = null
    }
  })()

  return _inflightRefresh
}

/**
 * Limpa sessão e redireciona para login.
 */
export function forceLogout() {
  clearHorizonteAccessToken()
  clearHorizonteRefreshToken()
  try {
    localStorage.removeItem('horizonte_user')
  } catch {
    /* ignore */
  }
  window.location.href = '/'
}

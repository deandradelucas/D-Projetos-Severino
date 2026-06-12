import { apiUrl } from './apiUrl'
import { clearAllUserCaches } from './clearUserCaches'
import {
  readHorizonteRefreshToken,
  writeHorizonteAccessToken,
  clearHorizonteAccessToken,
  clearHorizonteRefreshToken,
} from './horizonteAccessToken'

// Deduplicação: se já há um refresh em andamento, todos os callers aguardam o mesmo Promise.
let _inflightRefresh = null

/**
 * Tenta renovar o access token. O refresh token vive em cookie HttpOnly
 * (Story S1) — o browser o envia sozinho para /api/auth/refresh (same-origin).
 * Tokens legados ainda no localStorage são enviados uma única vez no body e,
 * com sucesso, migram para o cookie (o localStorage é limpo).
 * Retorna true se bem-sucedido, false se sessão expirada.
 */
export async function tryRefreshToken() {
  if (_inflightRefresh) return _inflightRefresh

  _inflightRefresh = (async () => {
    try {
      const legacyToken = readHorizonteRefreshToken()

      const res = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacyToken ? { refreshToken: legacyToken } : {}),
      })

      if (!res.ok) {
        clearHorizonteAccessToken()
        clearHorizonteRefreshToken()
        return false
      }

      const data = await res.json()
      if (!data.accessToken) {
        clearHorizonteAccessToken()
        clearHorizonteRefreshToken()
        return false
      }

      writeHorizonteAccessToken(data.accessToken)
      // Migração concluída: o servidor rotacionou o token legado para o cookie.
      if (legacyToken) clearHorizonteRefreshToken()
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
    // Caches financeiros de cold start saem junto da sessão (CACHE-01).
    const uid = JSON.parse(localStorage.getItem('horizonte_user') || 'null')?.id
    clearAllUserCaches(uid)
    localStorage.removeItem('horizonte_user')
  } catch {
    /* ignore */
  }
  window.location.href = '/'
}

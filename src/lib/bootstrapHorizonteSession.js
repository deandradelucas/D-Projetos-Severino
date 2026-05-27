import { readHorizonteAccessToken, readHorizonteRefreshToken } from './horizonteAccessToken'
import { tryRefreshToken, forceLogout } from './authRefresh'

/**
 * Garante access token em memória após F5 (refresh token persiste no localStorage).
 * @returns {'ok' | 'skip' | 'logout'} logout = forceLogout já redirecionou
 */
export async function ensureSessionAccessToken() {
  if (readHorizonteAccessToken()) return 'ok'

  const refresh = readHorizonteRefreshToken()
  if (!refresh) return 'skip'

  const ok = await tryRefreshToken()
  if (!ok) {
    forceLogout()
    return 'logout'
  }
  return 'ok'
}

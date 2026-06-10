import { readHorizonteAccessToken, readHorizonteRefreshToken } from './horizonteAccessToken'
import { tryRefreshToken, forceLogout } from './authRefresh'

/** O cookie HttpOnly é invisível ao JS — `horizonte_user` no localStorage é o
 * marcador de "tem sessão" (dados de perfil, não credencial). */
function hasSessionMarker() {
  try {
    return Boolean(localStorage.getItem('horizonte_user'))
  } catch {
    return false
  }
}

/**
 * Garante access token em memória após F5 (refresh token vive em cookie
 * HttpOnly — Story S1; tokens legados no localStorage ainda são aceitos).
 * @returns {'ok' | 'skip' | 'logout'} logout = forceLogout já redirecionou
 */
export async function ensureSessionAccessToken() {
  if (readHorizonteAccessToken()) return 'ok'

  const legacy = readHorizonteRefreshToken()
  if (!legacy && !hasSessionMarker()) return 'skip'

  const ok = await tryRefreshToken()
  if (!ok) {
    forceLogout()
    return 'logout'
  }
  return 'ok'
}

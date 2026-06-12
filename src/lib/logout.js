import { apiUrl } from './apiUrl'
import { clearHorizonteAccessToken, clearHorizonteRefreshToken, readHorizonteRefreshToken } from './horizonteAccessToken'
import { horizonteApiAuthHeaders } from './apiAuthHeaders'
import { clearAllUserCaches } from './clearUserCaches'

/**
 * Logout completo: revoga o refresh token no servidor (cookie HttpOnly vai
 * junto no request same-origin; token legado do localStorage vai no body) e
 * limpa a sessão local. Fire-and-forget — nunca bloqueia o redirect.
 */
export async function logoutHorizonte() {
  const legacyToken = readHorizonteRefreshToken()

  fetch(apiUrl('/api/auth/logout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...horizonteApiAuthHeaders() },
    body: JSON.stringify(legacyToken ? { refreshToken: legacyToken } : {}),
  }).catch(() => {})

  clearHorizonteAccessToken()
  clearHorizonteRefreshToken()
  try {
    // Lê o uid ANTES de remover a sessão — precisa dele pra achar as chaves.
    const uid = JSON.parse(localStorage.getItem('horizonte_user') || 'null')?.id
    clearAllUserCaches(uid)
    localStorage.removeItem('horizonte_user')
  } catch {
    /* ignore */
  }

  window.location.href = '/'
}

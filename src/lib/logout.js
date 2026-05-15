import { apiUrl } from './apiUrl'
import { clearHorizonteAccessToken, clearHorizonteRefreshToken, readHorizonteRefreshToken } from './horizonteAccessToken'
import { horizonteApiAuthHeaders } from './apiAuthHeaders'

/**
 * Logout completo: revoga o refresh token no servidor e limpa a sessão local.
 * Fire-and-forget no servidor — nunca bloqueia o redirect.
 */
export async function logoutHorizonte() {
  const refreshToken = readHorizonteRefreshToken()

  // Revogar no servidor em background (não bloquear o redirect)
  if (refreshToken) {
    fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...horizonteApiAuthHeaders() },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {})
  }

  clearHorizonteAccessToken()
  clearHorizonteRefreshToken()
  try {
    localStorage.removeItem('horizonte_user')
  } catch {
    /* ignore */
  }

  window.location.href = '/'
}

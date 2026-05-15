import { verifyAccessToken } from '../auth-access-token.mjs'

function bearerTokenFromAuthorization(value) {
  const raw = String(value || '').trim()
  const m = raw.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : ''
}

/**
 * Identidade da API: Bearer JWT (sub) primeiro; opcionalmente `x-user-id` se
 * `HORIZONTE_ALLOW_LEGACY_X_USER_ID=true` (rollback / migração).
 * @param {import('hono').Context} c
 * @returns {string}
 */
export function resolveRequestUserId(c) {
  const bearer = bearerTokenFromAuthorization(c.req.header('Authorization'))
  if (bearer) {
    const v = verifyAccessToken(bearer)
    if (v?.sub) return v.sub
  }
  if (String(process.env.HORIZONTE_ALLOW_LEGACY_X_USER_ID || '').trim().toLowerCase() === 'true') {
    return String(c.req.header('x-user-id') || '').trim()
  }
  return ''
}

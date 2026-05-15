import { verifyAccessToken } from '../auth-access-token.mjs'

function bearerTokenFromAuthorization(value) {
  const raw = String(value || '').trim()
  const m = raw.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : ''
}

/**
 * Identidade da API: Bearer JWT (sub).
 * @param {import('hono').Context} c
 * @returns {string}
 */
export function resolveRequestUserId(c) {
  const bearer = bearerTokenFromAuthorization(c.req.header('Authorization'))
  if (bearer) {
    const v = verifyAccessToken(bearer)
    if (v?.sub) return v.sub
  }
  return ''
}

// @ts-check
import crypto from 'node:crypto'

function b64urlEncodeJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url')
}

function getSecretForSigning() {
  const env = String(process.env.HORIZONTE_ACCESS_TOKEN_SECRET || '').trim()
  if (env) return env
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('HORIZONTE_ACCESS_TOKEN_SECRET em falta (produção).')
  }
  return 'horizonte-dev-only-access-token-secret-v1'
}

function getSecretForVerifying() {
  const env = String(process.env.HORIZONTE_ACCESS_TOKEN_SECRET || '').trim()
  if (env) return env
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    return null
  }
  return 'horizonte-dev-only-access-token-secret-v1'
}

function accessTokenTtlSeconds() {
  // Padrão: 15 minutos. Refresh token (30 dias) renova automaticamente via /api/auth/refresh.
  const raw = Number.parseInt(String(process.env.HORIZONTE_ACCESS_TOKEN_TTL_SECONDS || '900').trim(), 10)
  if (!Number.isFinite(raw)) return 900
  return Math.min(Math.max(raw, 60), 365 * 24 * 3600)
}

/**
 * JWT HS256 (assinatura HMAC-SHA256) sem dependência externa.
 * @param {string} userId
 * @returns {string}
 */
export function signAccessToken(userId) {
  const sub = String(userId || '').trim()
  if (!sub) throw new Error('signAccessToken: userId requerido')
  const secret = getSecretForSigning()
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + accessTokenTtlSeconds()
  const header = b64urlEncodeJson({ alg: 'HS256', typ: 'JWT' })
  const payload = b64urlEncodeJson({ sub, iat, exp })
  const sigInput = `${header}.${payload}`
  const sig = crypto.createHmac('sha256', secret).update(sigInput).digest('base64url')
  return `${sigInput}.${sig}`
}

/**
 * @param {string} token
 * @returns {{ sub: string, exp: number } | null}
 */
export function verifyAccessToken(token) {
  try {
    const secret = getSecretForVerifying()
    if (!secret) return null
    const parts = String(token || '').split('.')
    if (parts.length !== 3) return null
    const [h, p, sig] = parts
    if (!h || !p || !sig) return null
    const sigInput = `${h}.${p}`
    const expected = crypto.createHmac('sha256', secret).update(sigInput).digest('base64url')
    const a = Buffer.from(sig, 'base64url')
    const b = Buffer.from(expected, 'base64url')
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
    if (!payload?.sub || typeof payload.exp !== 'number') return null
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null
    return { sub: String(payload.sub).trim(), exp: payload.exp }
  } catch {
    return null
  }
}

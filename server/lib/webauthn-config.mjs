/**
 * RP ID e origens permitidas para WebAuthn (biometria / passkey).
 * Em produção HTTPS, o RP ID deve ser o hostname do site (sem porta).
 * Opcional: WEBAUTHN_RP_ID e WEBAUTHN_ORIGINS (lista separada por vírgula).
 */
export function getWebAuthnRpIdAndOrigins(c) {
  const envRp = String(process.env.WEBAUTHN_RP_ID || '').trim()
  const envOrigins = String(process.env.WEBAUTHN_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const originHeader = c.req.header('origin')
  const host = c.req.header('host') || ''
  const proto = c.req.header('x-forwarded-proto') || 'https'

  const origins = new Set(envOrigins)
  if (originHeader) {
    try {
      origins.add(originHeader)
    } catch {
      /* ignore */
    }
  }
  if (host) {
    origins.add(`${proto}://${host}`)
    if (proto === 'http') {
      origins.add(`http://${host}`)
    }
  }

  let rpID = envRp
  if (!rpID && originHeader) {
    try {
      rpID = new URL(originHeader).hostname
    } catch {
      /* ignore */
    }
  }
  if (!rpID && host) {
    rpID = host.split(':')[0]
  }

  return {
    rpID: rpID || 'localhost',
    origins: [...origins],
  }
}

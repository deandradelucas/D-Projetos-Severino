import {
  createResetToken,
  findUserByEmail,
  getExpiresAtIso,
  isValidEmail,
  sendResetEmail,
  storeResetToken,
} from '../../server/lib/password-reset.mjs'

export const runtime = 'nodejs'

function getRequestOrigin(req) {
  const explicitOrigin = req.headers.origin
  if (explicitOrigin) {
    return explicitOrigin
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host
  const protocol = req.headers['x-forwarded-proto'] || 'https'

  if (host) {
    return `${protocol}://${host}`
  }

  return 'http://localhost:3000'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed.' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const email = String(body.email || '').trim().toLowerCase()

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Informe um e-mail valido.' })
    }

    const user = await findUserByEmail(email)

    if (!user) {
      return res.status(200).json({
        message: 'Se este e-mail existir, enviaremos um link de redefinicao.',
      })
    }

    const origin = getRequestOrigin(req)
    const { rawToken, tokenHash } = createResetToken()
    const expiresAt = getExpiresAtIso()

    await storeResetToken({
      email,
      tokenHash,
      expiresAt,
    })

    const resetUrl = `${origin}/redefinir-senha?token=${rawToken}`
    const emailResult = await sendResetEmail({
      to: email,
      resetUrl,
    })

    return res.status(200).json({
      message: 'Se este e-mail existir, enviaremos um link de redefinicao.',
      devResetUrl: emailResult.devResetUrl || null,
    })
  } catch (error) {
    console.error('request-password-reset failed', error)
    return res.status(500).json({ message: 'Nao foi possivel enviar o link agora. Tente novamente em instantes.' })
  }
}

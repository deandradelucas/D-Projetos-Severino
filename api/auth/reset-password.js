import { consumeResetToken } from '../../server/lib/password-reset.mjs'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed.' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const token = String(body.token || '').trim()
    const password = String(body.password || '')

    if (!token) {
      return res.status(400).json({ message: 'Token invalido.' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'A senha deve ter no minimo 6 caracteres.' })
    }

    const updated = await consumeResetToken(token, password)

    if (!updated) {
      return res.status(400).json({ message: 'Link invalido ou expirado.' })
    }

    return res.status(200).json({ message: 'Senha redefinida com sucesso.' })
  } catch (error) {
    console.error('reset-password failed', error)
    return res.status(500).json({ message: 'Nao foi possivel redefinir a senha.' })
  }
}

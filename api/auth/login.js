import { authenticateUser, isValidEmail } from '../../server/lib/password-reset.mjs'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed.' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Informe um e-mail valido.' })
    }

    if (!password) {
      return res.status(400).json({ message: 'Preencha a senha.' })
    }

    const user = await authenticateUser(email, password)

    if (!user) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' })
    }

    return res.status(200).json({
      message: 'Login realizado com sucesso.',
      user,
    })
  } catch (error) {
    console.error('login failed', error)
    return res.status(500).json({ message: 'Nao foi possivel fazer login agora. Tente novamente em instantes.' })
  }
}

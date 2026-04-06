import { Hono } from 'hono'
import {
  consumeResetToken,
  createResetToken,
  findUserByEmail,
  getExpiresAtIso,
  getRequestOrigin,
  isValidEmail,
  sendResetEmail,
  storeResetToken,
} from './lib/password-reset.mjs'

const app = new Hono()

app.get('/api/health', (c) => c.json({ ok: true }))

app.post('/api/auth/request-password-reset', async (c) => {
  try {
    const body = await c.req.json()
    const email = String(body?.email || '').trim().toLowerCase()

    if (!isValidEmail(email)) {
      return c.json({ message: 'Informe um e-mail valido.' }, 400)
    }

    const user = await findUserByEmail(email)

    if (!user) {
      return c.json({
        message: 'Enviamos um link para seu e-mail.',
      })
    }

    const origin = getRequestOrigin(c)
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

    return c.json({
      message: 'Enviamos um link para seu e-mail.',
      devResetUrl: emailResult.devResetUrl || null,
    })
  } catch (error) {
    console.error('request-password-reset failed', error)
    return c.json({ message: 'Nao foi possivel enviar o link agora. Tente novamente em instantes.' }, 500)
  }
})

app.post('/api/auth/reset-password', async (c) => {
  try {
    const body = await c.req.json()
    const token = String(body?.token || '').trim()
    const password = String(body?.password || '')

    if (!token) {
      return c.json({ message: 'Token invalido.' }, 400)
    }

    if (password.length < 6) {
      return c.json({ message: 'A senha deve ter no minimo 6 caracteres.' }, 400)
    }

    const updated = await consumeResetToken(token, password)

    if (!updated) {
      return c.json({ message: 'Link invalido ou expirado.' }, 400)
    }

    return c.json({ message: 'Senha redefinida com sucesso.' })
  } catch (error) {
    console.error('reset-password failed', error)
    return c.json({ message: 'Nao foi possivel redefinir a senha.' }, 500)
  }
})

export default app

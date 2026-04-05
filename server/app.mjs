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
  const startedAt = Date.now()
  try {
    console.log('request-password-reset:start')
    const body = await c.req.json()
    console.log('request-password-reset:body-parsed', Date.now() - startedAt)
    const email = String(body?.email || '').trim().toLowerCase()

    if (!isValidEmail(email)) {
      return c.json({ message: 'Informe um e-mail valido.' }, 400)
    }

    const user = await findUserByEmail(email)
    console.log('request-password-reset:user-lookup', Date.now() - startedAt, Boolean(user))

    if (!user) {
      return c.json({
        message: 'Se este e-mail existir, enviaremos um link de redefinicao.',
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
    console.log('request-password-reset:token-stored', Date.now() - startedAt)

    const resetUrl = `${origin}/redefinir-senha?token=${rawToken}`
    const emailResult = await sendResetEmail({
      to: email,
      resetUrl,
    })
    console.log('request-password-reset:email-sent', Date.now() - startedAt, emailResult.provider || 'unknown')

    return c.json({
      message: 'Se este e-mail existir, enviaremos um link de redefinicao.',
      devResetUrl: emailResult.devResetUrl || null,
    })
  } catch (error) {
    console.error('request-password-reset failed', error)
    return c.json({ message: 'Nao foi possivel enviar o link agora. Tente novamente em instantes.' }, 500)
  }
})

app.post('/api/auth/reset-password', async (c) => {
  const startedAt = Date.now()
  try {
    console.log('reset-password:start')
    const body = await c.req.json()
    console.log('reset-password:body-parsed', Date.now() - startedAt)
    const token = String(body?.token || '').trim()
    const password = String(body?.password || '')

    if (!token) {
      return c.json({ message: 'Token invalido.' }, 400)
    }

    if (password.length < 6) {
      return c.json({ message: 'A senha deve ter no minimo 6 caracteres.' }, 400)
    }

    const updated = await consumeResetToken(token, password)
    console.log('reset-password:token-consumed', Date.now() - startedAt, updated)

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

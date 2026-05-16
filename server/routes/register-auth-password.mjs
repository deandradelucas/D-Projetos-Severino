import { log } from '../lib/logger.mjs'
import { isValidEmail } from '../lib/password-reset.mjs'
import { requestPasswordOtpWhatsApp, confirmPasswordOtpWhatsApp } from '../lib/password-otp-whatsapp.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { mapSupabaseOrNetworkError } from '../lib/http/hono-error-map.mjs'
import { parseJsonBody } from '../lib/http/parse-body.mjs'

export function registerAuthPasswordRoutes(app) {
  /** Redefinição de senha: código de 6 dígitos pelo WhatsApp (Evolution API). */
  app.post('/api/auth/request-password-otp-whatsapp', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`pw-otp-wa:${ip}`, 10, 15 * 60_000)) {
        return c.json({ message: 'Muitas solicitações. Tente de novo em alguns minutos.' }, 429)
      }
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'Envie JSON com o campo email.' }, 400)
      }
      const email = String(body?.email || '').trim().toLowerCase()
      if (!isValidEmail(email)) {
        return c.json({ message: 'Informe um e-mail válido.' }, 400)
      }
      if (!await rateLimitTake(`pw-otp-wa-email:${email}`, 5, 60 * 60_000)) {
        return c.json({ message: 'Limite de códigos para este e-mail. Tente mais tarde.' }, 429)
      }
      const result = await requestPasswordOtpWhatsApp(email)
      return c.json({ message: result.message })
    } catch (error) {
      log.error('request-password-otp-whatsapp failed', error)
      const status = error.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500
      if (status !== 500) {
        return c.json({ message: error.message || 'Solicitação inválida.' }, status)
      }
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível enviar o código agora.' }, 500)
    }
  })

  app.post('/api/auth/reset-password-whatsapp', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`pw-reset-wa:${ip}`, 20, 15 * 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde alguns minutos.' }, 429)
      }
      const parsed8 = await parseJsonBody(c)
      if (!parsed8.ok) return parsed8.response
      const body = parsed8.body
      const email = String(body?.email || '').trim().toLowerCase()
      const code = body?.code ?? body?.otp
      const password = String(body?.password || '')
      if (email && !await rateLimitTake(`otp-confirm-email:${email}`, 5, 15 * 60_000)) {
        return c.json({ message: 'Muitas tentativas para este e-mail. Solicite um novo código.' }, 429)
      }
      await confirmPasswordOtpWhatsApp(email, code, password)
      return c.json({ message: 'Senha redefinida com sucesso. Faça login.' })
    } catch (error) {
      log.error('reset-password-whatsapp failed', error)
      const status = error.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500
      if (status !== 500) {
        return c.json({ message: error.message || 'Não foi possível redefinir.' }, status)
      }
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível redefinir a senha.' }, 500)
    }
  })
}

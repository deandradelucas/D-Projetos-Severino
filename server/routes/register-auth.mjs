import bcrypt from 'bcryptjs'
import { log } from '../lib/logger.mjs'
import { clientIpFromHono } from '../lib/http/client-ip.mjs'
import { authenticateUser, isValidEmail } from '../lib/password-reset.mjs'
import { getSupabaseAdmin } from '../lib/supabase-admin.mjs'
import { sendRegistrationOtp, verifyRegistrationOtp } from '../lib/registration-otp.mjs'
import { evolutionEnvConfigured } from '../lib/evolution-send.mjs'
import { sendEmailOtp, verifyEmailOtp, emailOtpEnabled } from '../lib/email-otp.mjs'
import { insertAdminAuditLog } from '../lib/admin-audit.mjs'
import { buildAssinaturaUsuarioPayload, buildAssinaturaFallbackPayload } from '../lib/assinatura.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { mapSupabaseOrNetworkError } from '../lib/http/hono-error-map.mjs'
import { normalizeUsuarioRow, stripSenha } from '../lib/usuario-schema.mjs'
import { signAccessToken } from '../lib/auth-access-token.mjs'
import { Alerts } from '../lib/notify-telegram.mjs'
import { createRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../lib/refresh-token.mjs'
import { parseJsonBody } from '../lib/http/parse-body.mjs'
import { registerAuthWebAuthnRoutes } from './register-auth-webauthn.mjs'
import { registerAuthPasswordRoutes } from './register-auth-password.mjs'

export function registerAuthRoutes(app) {
  app.post('/api/auth/login', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`login:${ip}`, 25, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde cerca de um minuto e tente de novo.' }, 429)
      }
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'Corpo da requisição inválido. Envie JSON.' }, 400)
      }
      const email = String(body?.email || '').trim().toLowerCase()
      const password = String(body?.password || '')

      if (!isValidEmail(email)) {
        return c.json({ message: 'Informe um e-mail válido.' }, 400)
      }

      if (!password) {
        return c.json({ message: 'Preencha a senha.' }, 400)
      }

      let user
      try {
        user = await authenticateUser(email, password)
      } catch (authErr) {
        log.error('authenticateUser failed', authErr)
        const mapped = mapSupabaseOrNetworkError(authErr)
        if (mapped) {
          return c.json({ message: mapped.message }, mapped.status)
        }
        return c.json(
          {
            message:
              'Não foi possível validar o login (banco ou rede). Confira VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor e tente de novo.',
          },
          503
        )
      }

      if (!user) {
        return c.json({ message: 'E-mail ou senha incorretos.' }, 401)
      }

      let payloadUser = { ...user }
      try {
        const assinatura = await buildAssinaturaUsuarioPayload(user.id, user)
        payloadUser = { ...user, ...assinatura }
      } catch (err) {
        log.error('assinatura no login (confira migration 07_trial_bem_vindo_assinatura)', err)
        payloadUser = buildAssinaturaFallbackPayload(user)
      }

      await insertAdminAuditLog({
        actorUserId: user.id,
        targetUserId: user.id,
        targetEmail: user.email,
        action: 'login_sucesso',
        clientIp: clientIpFromHono(c),
        detail: { email: user.email, method: 'senha' },
      })

      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(user.id),
        createRefreshToken(user.id),
      ])
      return c.json({
        message: 'Login realizado com sucesso.',
        user: payloadUser,
        accessToken,
        refreshToken,
      })
    } catch (error) {
      log.error('login failed', error)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json(
        { message: 'Não foi possível fazer login agora. Tente novamente em alguns instantes.' },
        500
      )
    }
  })

  app.post('/api/auth/register', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`register:${ip}`, 10, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde cerca de um minuto e tente de novo.' }, 429)
      }
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'Corpo da requisição inválido. Envie JSON.' }, 400)
      }
      const nome = String(body?.nome || '').trim()
      const telefone = String(body?.telefone || '').trim()
      const email = String(body?.email || '').trim().toLowerCase()
      const senha = String(body?.senha || '')

      if (nome.length < 2) {
        return c.json({ message: 'Informe seu nome completo (mínimo 2 caracteres).' }, 400)
      }
      if (!isValidEmail(email)) {
        return c.json({ message: 'Informe um e-mail válido.' }, 400)
      }
      if (senha.length < 6) {
        return c.json({ message: 'A senha deve ter pelo menos 6 caracteres.' }, 400)
      }

      let telefoneLimpo = null
      if (telefone) {
        const digits = telefone.replace(/\D/g, '')
        if (digits.length < 10 || digits.length > 13) {
          return c.json({ message: 'Telefone inválido. Informe DDD + número (10 a 13 dígitos).' }, 400)
        }
        telefoneLimpo = digits
      }

      const supabaseAdmin = getSupabaseAdmin()

      // TTL de 30 min: se o email já existe mas nunca foi verificado, limpa e reutiliza
      const { data: existingEmail } = await supabaseAdmin
        .from('usuarios')
        .select('id, telefone_verificado, email_verificado, created_at')
        .eq('email', email)
        .limit(1)
        .maybeSingle()

      if (existingEmail) {
        const isVerified = existingEmail.telefone_verificado || existingEmail.email_verificado
        if (isVerified) {
          return c.json({ field: 'email', message: 'Este e-mail já está cadastrado.' }, 409)
        }
        const ageMs = Date.now() - new Date(existingEmail.created_at).getTime()
        if (ageMs < 30 * 60 * 1000) {
          // Cadastro recente e não verificado — bloqueia e orienta a reenviar código
          return c.json({
            field: 'email',
            message: 'Você já iniciou um cadastro com este e-mail. Use a opção "Reenviar código" para receber o código novamente.',
          }, 409)
        }
        // Cadastro antigo e não verificado — limpa e libera para novo cadastro
        log.warn('[register] removendo cadastro não verificado expirado para reutilizar email', existingEmail.id)
        await supabaseAdmin.from('usuarios').delete().eq('id', existingEmail.id)
          .catch(e => log.error('[register] falha ao limpar cadastro expirado', e))
      }

      if (telefoneLimpo) {
        const { data: existingPhone } = await supabaseAdmin
          .from('usuarios')
          .select('id, telefone_verificado, email_verificado, created_at')
          .eq('telefone', telefoneLimpo)
          .limit(1)
          .maybeSingle()
        if (existingPhone) {
          const isVerified = existingPhone.telefone_verificado || existingPhone.email_verificado
          if (isVerified) {
            return c.json({ field: 'telefone', message: 'Este número de WhatsApp já está cadastrado. Tente fazer login.' }, 409)
          }
          const ageMs = Date.now() - new Date(existingPhone.created_at).getTime()
          if (ageMs < 30 * 60 * 1000) {
            return c.json({
              field: 'telefone',
              message: 'Você já iniciou um cadastro com este número. Use a opção "Reenviar código" para receber o código novamente.',
            }, 409)
          }
          log.warn('[register] removendo cadastro não verificado expirado para reutilizar telefone', existingPhone.id)
          await supabaseAdmin.from('usuarios').delete().eq('id', existingPhone.id)
            .catch(e => log.error('[register] falha ao limpar cadastro expirado', e))
        }
      }

      const senhaHash = await bcrypt.hash(senha, 10)

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('usuarios')
        .insert({ nome, email, telefone: telefoneLimpo, senha: senhaHash })
        .select('*')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          const detail = (insertError.constraint || insertError.details || insertError.message || '').toLowerCase()
          if (detail.includes('telefone') || detail.includes('phone')) {
            return c.json({ field: 'telefone', message: 'Este número de WhatsApp já está cadastrado. Tente fazer login.' }, 409)
          }
          return c.json({ field: 'email', message: 'Este e-mail já está cadastrado.' }, 409)
        }
        log.error('register insert error', insertError)
        const mapped = mapSupabaseOrNetworkError(insertError)
        if (mapped) return c.json({ message: mapped.message }, mapped.status)
        return c.json({ message: 'Não foi possível criar a conta. Tente novamente.' }, 500)
      }

      const safeUser = normalizeUsuarioRow(stripSenha(newUser))
      let payloadUser = { ...safeUser }
      try {
        const assinatura = await buildAssinaturaUsuarioPayload(newUser.id, safeUser)
        payloadUser = { ...newUser, ...assinatura }
      } catch (err) {
        log.error('assinatura no cadastro (confira migration 07_trial_bem_vindo_assinatura)', err)
        payloadUser = buildAssinaturaFallbackPayload(safeUser)
      }

      await insertAdminAuditLog({
        actorUserId: newUser.id,
        targetUserId: newUser.id,
        targetEmail: newUser.email,
        action: 'cadastro_sucesso',
        clientIp: clientIpFromHono(c),
        detail: { email: newUser.email },
      })
      Alerts.novoCadastro({ nome: newUser.nome, email: newUser.email, telefone: newUser.telefone })

      const hasPhone = evolutionEnvConfigured() && Boolean(telefoneLimpo)
      const hasEmail = emailOtpEnabled()

      let telefoneMascarado = null
      let emailMascarado = null

      if (hasPhone) {
        try {
          const { number } = await sendRegistrationOtp(newUser.id, telefoneLimpo)
          telefoneMascarado = number.slice(0, 4) + '…' + number.slice(-2)
        } catch (otpErr) {
          log.warn('[register] falha ao enviar OTP WhatsApp — revertendo cadastro', otpErr.message)
          await supabaseAdmin.from('usuarios').delete().eq('id', newUser.id).catch((e) =>
            log.error('[register] falha ao reverter usuário após OTP inválido', e)
          )
          const status = otpErr.statusCode && Number.isFinite(otpErr.statusCode) ? otpErr.statusCode : 400
          return c.json({
            message: otpErr.message || 'Não foi possível enviar o código de verificação. Verifique se o número tem WhatsApp ativo e tente novamente.',
          }, status)
        }
      }

      if (hasEmail) {
        try {
          const { masked } = await sendEmailOtp(newUser.id, newUser.email)
          emailMascarado = masked
        } catch (otpErr) {
          log.warn('[register] falha ao enviar OTP e-mail, seguindo sem verificação de e-mail', otpErr.message)
        }
      }

      if (telefoneMascarado || emailMascarado) {
        return c.json({
          needsPhoneVerification: Boolean(telefoneMascarado),
          needsEmailVerification: Boolean(emailMascarado),
          userId: newUser.id,
          telefoneMascarado,
          emailMascarado,
          message: 'Conta criada. Confirme seus dados para continuar.',
        })
      }

      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(newUser.id),
        createRefreshToken(newUser.id),
      ])
      return c.json({ message: 'Conta criada com sucesso.', user: payloadUser, accessToken, refreshToken })
    } catch (error) {
      log.error('register failed', error)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível criar a conta agora. Tente novamente em alguns instantes.' }, 500)
    }
  })

  app.post('/api/auth/verify-registration', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`verify-reg:${ip}`, 15, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      const parsed0 = await parseJsonBody(c)
      if (!parsed0.ok) return parsed0.response
      const body = parsed0.body
      const userId = String(body?.userId || '').trim()
      const otp = String(body?.otp || '').replace(/\D/g, '')
      if (!userId) return c.json({ message: 'userId é obrigatório.' }, 400)

      if (!await rateLimitTake(`verify-reg-user:${userId}`, 5, 15 * 60_000)) {
        return c.json({ message: 'Muitas tentativas para este usuário. Solicite um novo código.' }, 429)
      }

      await verifyRegistrationOtp(userId, otp)

      const supabaseAdmin = getSupabaseAdmin()
      const { data: userRow, error: fetchErr } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()
      if (fetchErr || !userRow) {
        return c.json({ message: 'Usuário não encontrado.' }, 404)
      }

      const safeUser = normalizeUsuarioRow(stripSenha(userRow))
      let payloadUser = { ...safeUser }
      try {
        const assinatura = await buildAssinaturaUsuarioPayload(userRow.id, safeUser)
        payloadUser = { ...safeUser, ...assinatura }
      } catch (err) {
        log.error('assinatura no verify-registration', err)
        payloadUser = buildAssinaturaFallbackPayload(safeUser)
      }

      if (emailOtpEnabled()) {
        const { data: freshRow } = await getSupabaseAdmin()
          .from('usuarios')
          .select('email_verificado')
          .eq('id', userId)
          .single()
        if (!freshRow?.email_verificado) {
          return c.json({ needsEmailVerification: true, userId })
        }
      }

      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(payloadUser.id),
        createRefreshToken(payloadUser.id),
      ])
      return c.json({
        message: 'Telefone confirmado com sucesso.',
        user: payloadUser,
        accessToken,
        refreshToken,
      })
    } catch (error) {
      log.error('verify-registration failed', error)
      const status = error.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500
      if (status !== 500) return c.json({ message: error.message || 'Código inválido.' }, status)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível confirmar o telefone. Tente novamente.' }, 500)
    }
  })

  app.post('/api/auth/resend-registration-otp', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`resend-reg-otp:${ip}`, 5, 15 * 60_000)) {
        return c.json({ message: 'Muitas solicitações. Aguarde alguns minutos.' }, 429)
      }
      const parsed1 = await parseJsonBody(c)
      if (!parsed1.ok) return parsed1.response
      const body = parsed1.body
      const userId = String(body?.userId || '').trim()
      if (!userId) return c.json({ message: 'userId é obrigatório.' }, 400)

      if (!await rateLimitTake(`resend-reg-otp-user:${userId}`, 3, 15 * 60_000)) {
        return c.json({ message: 'Limite de reenvios atingido para este número. Aguarde 15 minutos.' }, 429)
      }

      const supabaseAdmin = getSupabaseAdmin()
      const { data: userRow, error: fetchErr } = await supabaseAdmin
        .from('usuarios')
        .select('id, telefone, whatsapp_id, telefone_verificado')
        .eq('id', userId)
        .single()
      if (fetchErr || !userRow) return c.json({ message: 'Usuário não encontrado.' }, 404)
      if (userRow.telefone_verificado) return c.json({ message: 'Telefone já confirmado.' }, 400)

      const telefone = userRow.telefone || userRow.whatsapp_id
      if (!telefone) return c.json({ message: 'Nenhum telefone cadastrado para reenvio.' }, 400)

      const { number } = await sendRegistrationOtp(userId, telefone)
      const masked = number.slice(0, 4) + '…' + number.slice(-2)
      return c.json({ message: `Novo código enviado para ${masked}.` })
    } catch (error) {
      log.error('resend-registration-otp failed', error)
      const status = error.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500
      if (status !== 500) return c.json({ message: error.message || 'Erro ao reenviar.' }, status)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível reenviar o código. Tente novamente.' }, 500)
    }
  })

  app.post('/api/auth/verify-email-otp', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`verify-email-otp:${ip}`, 15, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      const parsed2 = await parseJsonBody(c)
      if (!parsed2.ok) return parsed2.response
      const body = parsed2.body
      const userId = String(body?.userId || '').trim()
      const otp = String(body?.otp || '').replace(/\D/g, '')
      if (!userId) return c.json({ message: 'userId é obrigatório.' }, 400)

      if (!await rateLimitTake(`verify-email-otp-user:${userId}`, 5, 15 * 60_000)) {
        return c.json({ message: 'Muitas tentativas para este e-mail. Solicite um novo código.' }, 429)
      }

      await verifyEmailOtp(userId, otp)

      const supabaseAdmin = getSupabaseAdmin()
      const { data: userRow, error: fetchErr } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()
      if (fetchErr || !userRow) {
        return c.json({ message: 'Usuário não encontrado.' }, 404)
      }

      const safeUser = normalizeUsuarioRow(stripSenha(userRow))
      let payloadUser = { ...safeUser }
      try {
        const assinatura = await buildAssinaturaUsuarioPayload(userRow.id, safeUser)
        payloadUser = { ...safeUser, ...assinatura }
      } catch (err) {
        log.error('assinatura no verify-email-otp', err)
        payloadUser = buildAssinaturaFallbackPayload(safeUser)
      }

      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(payloadUser.id),
        createRefreshToken(payloadUser.id),
      ])
      return c.json({
        message: 'E-mail confirmado com sucesso.',
        user: payloadUser,
        accessToken,
        refreshToken,
      })
    } catch (error) {
      log.error('verify-email-otp failed', error)
      const status = error.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500
      if (status !== 500) return c.json({ message: error.message || 'Código inválido.' }, status)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível confirmar o e-mail. Tente novamente.' }, 500)
    }
  })

  app.post('/api/auth/resend-email-otp', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`resend-email-otp:${ip}`, 5, 15 * 60_000)) {
        return c.json({ message: 'Muitas solicitações. Aguarde alguns minutos.' }, 429)
      }
      const parsed3 = await parseJsonBody(c)
      if (!parsed3.ok) return parsed3.response
      const body = parsed3.body
      const userId = String(body?.userId || '').trim()
      if (!userId) return c.json({ message: 'userId é obrigatório.' }, 400)

      if (!await rateLimitTake(`resend-email-otp-user:${userId}`, 3, 15 * 60_000)) {
        return c.json({ message: 'Limite de reenvios atingido para este e-mail. Aguarde 15 minutos.' }, 429)
      }

      const supabaseAdmin = getSupabaseAdmin()
      const { data: userRow, error: fetchErr } = await supabaseAdmin
        .from('usuarios')
        .select('id, email, email_verificado')
        .eq('id', userId)
        .single()
      if (fetchErr || !userRow) return c.json({ message: 'Usuário não encontrado.' }, 404)
      if (userRow.email_verificado) return c.json({ message: 'E-mail já confirmado.' }, 400)

      const { masked } = await sendEmailOtp(userId, userRow.email)
      return c.json({ message: `Novo código enviado para ${masked}.` })
    } catch (error) {
      log.error('resend-email-otp failed', error)
      const status = error.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500
      if (status !== 500) return c.json({ message: error.message || 'Erro ao reenviar.' }, status)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível reenviar o código. Tente novamente.' }, 500)
    }
  })

  /** Troca o refresh token por um novo par access + refresh (rotação). */
  app.post('/api/auth/refresh', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`refresh:${ip}`, 30, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      const parsed7 = await parseJsonBody(c)
      if (!parsed7.ok) return parsed7.response
      const body = parsed7.body
      const plainToken = String(body?.refreshToken || '').trim()
      if (!plainToken) return c.json({ message: 'refreshToken é obrigatório.' }, 400)

      const result = await rotateRefreshToken(plainToken)
      if (!result) return c.json({ message: 'Sessão expirada. Faça login novamente.' }, 401)

      const accessToken = signAccessToken(result.usuarioId)
      return c.json({ accessToken, refreshToken: result.newRefreshToken })
    } catch (error) {
      log.error('auth refresh failed', error)
      return c.json({ message: 'Não foi possível renovar a sessão.' }, 500)
    }
  })

  /** Revoga o refresh token (logout real — access token expira sozinho em 15min). */
  app.post('/api/auth/logout', async (c) => {
    try {
      let body
      try {
        body = await c.req.json()
      } catch {
        body = {}
      }
      const plainToken = String(body?.refreshToken || '').trim()
      if (plainToken) await revokeRefreshToken(plainToken)
      return c.json({ ok: true })
    } catch (error) {
      log.error('auth logout failed', error)
      return c.json({ ok: true }) // logout nunca falha para o cliente
    }
  })

  registerAuthWebAuthnRoutes(app)
  registerAuthPasswordRoutes(app)
}

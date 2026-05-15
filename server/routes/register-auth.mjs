import bcrypt from 'bcryptjs'
import { log } from '../lib/logger.mjs'
import { clientIpFromHono } from '../lib/http/client-ip.mjs'
import { authenticateUser, isValidEmail } from '../lib/password-reset.mjs'
import { getSupabaseAdmin } from '../lib/supabase-admin.mjs'
import { requestPasswordOtpWhatsApp, confirmPasswordOtpWhatsApp } from '../lib/password-otp-whatsapp.mjs'
import { sendRegistrationOtp, verifyRegistrationOtp } from '../lib/registration-otp.mjs'
import { evolutionEnvConfigured } from '../lib/evolution-send.mjs'
import { sendEmailOtp, verifyEmailOtp, emailOtpEnabled } from '../lib/email-otp.mjs'
import { getPerfilUsuario } from '../lib/usuarios.mjs'
import { insertAdminAuditLog } from '../lib/admin-audit.mjs'
import { buildAssinaturaUsuarioPayload, buildAssinaturaFallbackPayload } from '../lib/assinatura.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { mapSupabaseOrNetworkError } from '../lib/http/hono-error-map.mjs'
import { isUuidString } from '../lib/transacao-validate.mjs'
import { normalizeUsuarioRow, stripSenha } from '../lib/usuario-schema.mjs'
import {
  beginRegistration,
  finishRegistration,
  beginAuthentication,
  finishAuthentication,
  findUserByEmailForWebAuthn,
  countWebAuthnCredentialsForUsuario,
  deleteCredentialForUser,
  listCredentialSummariesForUser,
} from '../lib/webauthn.mjs'
import { signAccessToken } from '../lib/auth-access-token.mjs'
import { createRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../lib/refresh-token.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

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

      const { data: existing } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('email', email)
        .limit(1)

      if (existing && existing.length > 0) {
        return c.json({ message: 'Este e-mail já está cadastrado.' }, 409)
      }

      const senhaHash = await bcrypt.hash(senha, 10)

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('usuarios')
        .insert({ nome, email, telefone: telefoneLimpo, senha: senhaHash })
        .select('*')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          return c.json({ message: 'Este e-mail já está cadastrado.' }, 409)
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

      const hasPhone = evolutionEnvConfigured() && Boolean(telefoneLimpo)
      const hasEmail = emailOtpEnabled()

      let telefoneMascarado = null
      let emailMascarado = null

      if (hasPhone) {
        try {
          const { number } = await sendRegistrationOtp(newUser.id, telefoneLimpo)
          telefoneMascarado = number.slice(0, 4) + '…' + number.slice(-2)
        } catch (otpErr) {
          log.warn('[register] falha ao enviar OTP WhatsApp, seguindo sem verificação de telefone', otpErr.message)
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
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }
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
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }
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
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }
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
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }
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

  /** WebAuthn — biometria / passkey (celular, tablet; requer HTTPS exceto localhost) */
  app.post('/api/auth/webauthn/register/options', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`webauthn-reg-opt:${ip}`, 20, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      const perfil = await getPerfilUsuario(usuarioId)
      if (!perfil?.email) return c.json({ message: 'Perfil não encontrado.' }, 404)

      const { optionsJSON, challengeId } = await beginRegistration({
        c,
        usuarioId,
        userEmail: perfil.email,
        userName: perfil.nome || perfil.email,
      })
      return c.json({ optionsJSON, challengeId })
    } catch (error) {
      log.error('webauthn register options', error)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível preparar o registro biométrico.' }, 500)
    }
  })

  app.post('/api/auth/webauthn/register/verify', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`webauthn-reg-verify:${ip}`, 20, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }
      const challengeId = String(body?.challengeId || '')
      const credential = body?.credential
      if (!challengeId || !credential) {
        return c.json({ message: 'challengeId e credential são obrigatórios.' }, 400)
      }

      const result = await finishRegistration({ c, usuarioId, challengeId, credential, log })
      if (!result.verified) {
        return c.json({ message: 'Não foi possível confirmar a biometria. Tente de novo.' }, 400)
      }
      return c.json({ ok: true })
    } catch (error) {
      log.error('webauthn register verify', error)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Erro ao salvar credencial biométrica.' }, 500)
    }
  })

  app.get('/api/auth/webauthn/status', async (c) => {
    try {
      const email = String(c.req.query('email') || '')
        .trim()
        .toLowerCase()
      if (!isValidEmail(email)) {
        return c.json({ hasCredential: false })
      }
      const user = await findUserByEmailForWebAuthn(email)
      if (!user?.id) {
        return c.json({ hasCredential: false })
      }
      const n = await countWebAuthnCredentialsForUsuario(user.id)
      return c.json({ hasCredential: n > 0 })
    } catch (error) {
      log.error('webauthn status', error)
      return c.json({ hasCredential: false })
    }
  })

  app.post('/api/auth/webauthn/login/options', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`webauthn-auth-opt:${ip}`, 25, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }
      const email = String(body?.email || '')
        .trim()
        .toLowerCase()
      if (!isValidEmail(email)) {
        return c.json({ message: 'Informe um e-mail válido.' }, 400)
      }

      const started = await beginAuthentication({ c, email })
      if (!started) {
        return c.json({ message: 'Nenhuma biometria cadastrada para este e-mail.' }, 404)
      }
      const { optionsJSON, challengeId } = started
      return c.json({ optionsJSON, challengeId })
    } catch (error) {
      log.error('webauthn login options', error)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível preparar o login biométrico.' }, 500)
    }
  })

  app.post('/api/auth/webauthn/login/verify', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`webauthn-auth-verify:${ip}`, 25, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }
      const challengeId = String(body?.challengeId || '')
      const credential = body?.credential
      if (!challengeId || !credential) {
        return c.json({ message: 'challengeId e credential são obrigatórios.' }, 400)
      }

      const out = await finishAuthentication({ c, challengeId, credential, log })
      if (!out) {
        return c.json({ message: 'Biometria não reconhecida. Use a senha ou tente de novo.' }, 401)
      }
      const u = out.user
      if (u?.id && u?.email) {
        await insertAdminAuditLog({
          actorUserId: u.id,
          targetUserId: u.id,
          targetEmail: u.email,
          action: 'login_sucesso',
          clientIp: clientIpFromHono(c),
          detail: { email: u.email, method: 'webauthn' },
        })
      }
      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(out.user.id),
        createRefreshToken(out.user.id),
      ])
      return c.json({ ...out, accessToken, refreshToken })
    } catch (error) {
      log.error('webauthn login verify', error)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível validar a biometria.' }, 500)
    }
  })

  app.get('/api/auth/webauthn/credentials', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const rows = await listCredentialSummariesForUser(usuarioId)
      return c.json({ credentials: rows })
    } catch (error) {
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) {
        log.warn('webauthn list credentials', error?.message || error)
        return c.json({ message: mapped.message }, mapped.status)
      }
      log.error('webauthn list credentials', error)
      return c.json({ message: 'Erro ao listar credenciais biométricas.' }, 500)
    }
  })

  app.delete('/api/auth/webauthn/credentials/:id', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const id = c.req.param('id')
      if (!isUuidString(id)) {
        return c.json({ message: 'ID inválido.' }, 400)
      }
      await deleteCredentialForUser({ usuarioId, credentialId: id })
      return c.json({ ok: true })
    } catch (error) {
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) {
        log.warn('webauthn delete credential', error?.message || error)
        return c.json({ message: mapped.message }, mapped.status)
      }
      log.error('webauthn delete credential', error)
      return c.json({ message: 'Não foi possível remover.' }, 500)
    }
  })

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

  /** Troca o refresh token por um novo par access + refresh (rotação). */
  app.post('/api/auth/refresh', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`refresh:${ip}`, 30, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }
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

  app.post('/api/auth/reset-password-whatsapp', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`pw-reset-wa:${ip}`, 20, 15 * 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde alguns minutos.' }, 429)
      }
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }
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

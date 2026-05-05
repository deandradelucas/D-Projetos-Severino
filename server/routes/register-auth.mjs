import { log } from '../lib/logger.mjs'
import { clientIpFromHono } from '../lib/http/client-ip.mjs'
import { authenticateUser, isValidEmail } from '../lib/password-reset.mjs'
import { requestPasswordOtpWhatsApp, confirmPasswordOtpWhatsApp } from '../lib/password-otp-whatsapp.mjs'
import { getPerfilUsuario } from '../lib/usuarios.mjs'
import { insertAdminAuditLog } from '../lib/admin-audit.mjs'
import { buildAssinaturaUsuarioPayload } from '../lib/assinatura.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { mapSupabaseOrNetworkError } from '../lib/http/hono-error-map.mjs'
import { isUuidString } from '../lib/transacao-validate.mjs'
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

export function registerAuthRoutes(app) {
  app.post('/api/auth/login', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!rateLimitTake(`login:${ip}`, 25, 60_000)) {
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
        payloadUser = {
          ...user,
          trial_ends_at: null,
          bem_vindo_pagamento_visto_at: null,
          assinatura_paga: false,
          acesso_app_liberado: true,
          mostrar_bem_vindo_assinatura: false,
          trial_dias_gratis: 7,
          assinatura_proxima_cobranca: null,
          assinatura_mp_status: null,
          plano_preco_mensal: Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10') || 10,
          assinatura_situacao: 'inativa',
          assinatura_mp_bloqueada: false,
          motivo_bloqueio_acesso: null,
          mp_gerenciar_url: null,
        }
      }

      await insertAdminAuditLog({
        actorUserId: user.id,
        action: 'login_sucesso',
        clientIp: clientIpFromHono(c),
        detail: { email: user.email },
      })

      return c.json({
        message: 'Login realizado com sucesso.',
        user: payloadUser,
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

  /** WebAuthn — biometria / passkey (celular, tablet; requer HTTPS exceto localhost) */
  app.post('/api/auth/webauthn/register/options', async (c) => {
    try {
      const ip = clientKeyFromHono(c)
      if (!rateLimitTake(`webauthn-reg-opt:${ip}`, 20, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      const usuarioId = String(c.req.header('x-user-id') || '').trim()
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
      if (!rateLimitTake(`webauthn-reg-verify:${ip}`, 20, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      const usuarioId = String(c.req.header('x-user-id') || '').trim()
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
      if (!rateLimitTake(`webauthn-auth-opt:${ip}`, 25, 60_000)) {
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
      if (!rateLimitTake(`webauthn-auth-verify:${ip}`, 25, 60_000)) {
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
      return c.json(out)
    } catch (error) {
      log.error('webauthn login verify', error)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Não foi possível validar a biometria.' }, 500)
    }
  })

  app.get('/api/auth/webauthn/credentials', async (c) => {
    try {
      const usuarioId = String(c.req.header('x-user-id') || '').trim()
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
      const usuarioId = String(c.req.header('x-user-id') || '').trim()
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
      if (!rateLimitTake(`pw-otp-wa:${ip}`, 10, 15 * 60_000)) {
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
      if (!rateLimitTake(`pw-otp-wa-email:${email}`, 5, 60 * 60_000)) {
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
      if (!rateLimitTake(`pw-reset-wa:${ip}`, 20, 15 * 60_000)) {
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

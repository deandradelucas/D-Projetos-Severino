import { log } from '../lib/logger.mjs'
import { clientIpFromHono } from '../lib/http/client-ip.mjs'
import { isValidEmail } from '../lib/password-reset.mjs'
import { getPerfilUsuario } from '../lib/usuarios.mjs'
import { insertAdminAuditLog } from '../lib/admin-audit.mjs'
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
import { signAccessToken } from '../lib/auth-access-token.mjs'
import { createRefreshToken } from '../lib/refresh-token.mjs'
import { setRefreshCookie } from '../lib/auth-cookie.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'
import { parseJsonBody } from '../lib/http/parse-body.mjs'

export function registerAuthWebAuthnRoutes(app) {
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

      const parsed4 = await parseJsonBody(c)
      if (!parsed4.ok) return parsed4.response
      const body = parsed4.body
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
      const parsed5 = await parseJsonBody(c)
      if (!parsed5.ok) return parsed5.response
      const body = parsed5.body
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
      const parsed6 = await parseJsonBody(c)
      if (!parsed6.ok) return parsed6.response
      const body = parsed6.body
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
      /* Story S1: refresh token só em cookie HttpOnly. */
      setRefreshCookie(c, refreshToken)
      return c.json({ ...out, accessToken })
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
}

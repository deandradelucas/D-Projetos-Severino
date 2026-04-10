import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { log } from './lib/logger.mjs'
import { cors } from 'hono/cors'
import {
  authenticateUser,
  consumeResetToken,
  getRequestOrigin,
  isValidEmail,
  sendPasswordResetLink,
} from './lib/password-reset.mjs'
import {
  getCategorias,
  inserirTransacao,
  getTransacoes,
  atualizarTransacao,
  deletarTransacao,
} from './lib/transacoes.mjs'
import {
  assertCronSecret,
  criarRegraRecorrenciaDia1,
  desativarRecorrenciaMensal,
  listarRecorrenciasMensais,
  processarRecorrenciasPendentes,
} from './lib/recorrencias-mensais.mjs'
import {
  getPerfilUsuario,
  getWhatsappLogs,
  getWhatsappStatus,
  listUsuariosAdminPaged,
  updateUsuarioAdmin,
  deleteUsuarioAdmin,
} from './lib/usuarios.mjs'
import { insertAdminAuditLog, listAdminAuditLog } from './lib/admin-audit.mjs'
import { handleWhatsAppWebhook } from './lib/whatsapp.mjs'
import { askHorizon } from './lib/ai.mjs'
import {
  buscarPagamentoPorId,
  criarPreapprovalAssinaturaMensal,
  getMercadoPagoAccessToken,
  getMercadoPagoPublicKey,
  isMercadoPagoConfigured,
  useSandboxCheckout,
} from './lib/mercadopago.mjs'
import {
  insertPreferenciaRecord,
  listPagamentosUsuario,
  listPagamentosAdmin,
  deletePagamentosPendentesAdmin,
  sincronizarPagamentosPendentesDoUsuario,
  sincronizarPreapprovalUsuario,
  sincronizarPreapprovalPorIdFromWebhook,
  atualizarUsuarioDePreapprovalResponse,
  upsertFromWebhookPayment,
} from './lib/pagamentos-mp.mjs'
import {
  assertAcessoAppUsuario,
  buildAssinaturaUsuarioPayload,
  marcarBemVindoPagamentoVisto,
} from './lib/assinatura.mjs'
import { isSuperAdminEmail } from './lib/super-admin.mjs'
import { loadEnv } from './lib/load-env.mjs'
import { rateLimitTake, clientKeyFromHono } from './lib/rate-limit.mjs'
import {
  validateNovaTransacaoBody,
  validateAtualizacaoTransacaoBody,
  validateTransacoesListQuery,
  isUuidString,
} from './lib/transacao-validate.mjs'
import { logMpWebhook } from './lib/mp-webhook-log.mjs'
import {
  beginRegistration,
  finishRegistration,
  beginAuthentication,
  finishAuthentication,
  findUserByEmailForWebAuthn,
  countWebAuthnCredentialsForUsuario,
  deleteCredentialForUser,
  listCredentialSummariesForUser,
} from './lib/webauthn.mjs'

loadEnv()

const app = new Hono()

function clientIpFromHono(c) {
  const xf = c.req.header('x-forwarded-for')
  if (xf) return String(xf).split(',')[0].trim().slice(0, 80)
  const alt = c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || ''
  return String(alt).slice(0, 80)
}

/** Contas com role ADMIN no banco ou o e-mail SUPER_ADMIN acessam /api/admin/*. */
async function assertPrincipalAdmin(usuarioId) {
  if (!usuarioId) return { status: 401, message: 'Não autorizado.' }
  const perfil = await getPerfilUsuario(usuarioId)
  if (!perfil) return { status: 401, message: 'Não autorizado.' }
  const email = String(perfil.email || '').trim().toLowerCase()
  const role = String(perfil.role || 'USER').toUpperCase()
  if (isSuperAdminEmail(email) || role === 'ADMIN') return null
  return { status: 403, message: 'Acesso restrito a administradores.' }
}

function corsAllowedOrigin(origin) {
  if (!origin) return '*'
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin
  // Testes no celular na rede local (Vite em outro IP da LAN)
  if (
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin)
  ) {
    return origin
  }
  // Produção: domínios próprios (ex.: horizontefinanceiro.mestredamente.com no mesmo projeto Vercel)
  if (/^https:\/\/([a-z0-9-]+\.)*mestredamente\.com$/i.test(origin)) return origin
  const extra = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (extra.includes(origin)) return origin
  return null
}

// Permite localhost, LAN (PWA no celular) e origens em CORS_ORIGINS (produção com front separado)
app.use('*', cors({
  origin: (origin) => corsAllowedOrigin(origin),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'x-user-id', 'Authorization'],
}))

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    t: new Date().toISOString(),
    mercadopago: { configured: isMercadoPagoConfigured() },
  })
)

/** Contato WhatsApp (link ou número) — público; use quando o front não tiver VITE_WHATSAPP_*. */
function whatsappContactUrlFromEnv() {
  const link = process.env.WHATSAPP_CONTACT_LINK?.trim()
  if (link) return link
  const phone = String(process.env.WHATSAPP_CONTACT_PHONE || '').replace(/\D/g, '')
  if (phone) return `https://wa.me/${phone}`
  return 'https://wa.me/5547999895014'
}

app.get('/api/public/whatsapp-contact', (c) => c.json({ url: whatsappContactUrlFromEnv() }))

/** Painel interno: token MP configurado e path do webhook (sem segredos). */
app.get('/api/admin/mp-saude', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)
    return c.json({
      mercado_pago_access_token_configured: isMercadoPagoConfigured(),
      webhook_get_post: '/api/pagamentos/webhook',
      nota:
        'No painel Mercado Pago, a URL de notificação deve apontar para este path e responder 200. Logs estruturados: svc=mercadopago-webhook no stdout.',
    })
  } catch (error) {
    log.error('mp-saude failed', error)
    return c.json({ message: 'Erro ao montar painel.' }, 500)
  }
})

/** Texto útil a partir de Error, PostgrestError ou objeto genérico. */
function errorToText(error) {
  if (error == null) return ''
  if (typeof error === 'string') return error
  if (typeof error.message === 'string' && error.message) {
    const bits = [error.message, error.details, error.hint, error.code].filter(Boolean)
    return bits.join(' | ')
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/** Erros de configuração/rede do Supabase — retorna null se for falha genérica. */
function mapSupabaseOrNetworkError(error) {
  const raw = errorToText(error)
  if (raw.includes('Missing VITE_SUPABASE_URL') || raw.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return {
      status: 503,
      message:
        'Banco de dados não configurado. Em desenvolvimento, crie um arquivo .env na raiz do projeto com VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (copie de env.example). No Vercel, defina as mesmas variáveis no projeto e faça um novo deploy.',
    }
  }
  if (/Invalid supabaseUrl|Invalid VITE_SUPABASE_URL|Must be a valid HTTP or HTTPS URL/i.test(raw)) {
    return {
      status: 503,
      message:
        'URL do Supabase inválida. No .env, defina VITE_SUPABASE_URL como a URL do projeto (https://….supabase.co), sem aspas nem espaços — copie de Settings → API no painel do Supabase.',
    }
  }
  if (/Invalid API key|JWT expired|invalid value for JWT|JWT|API key/i.test(raw)) {
    return {
      status: 503,
      message:
        'Chave do Supabase inválida ou ausente. Confira SUPABASE_SERVICE_ROLE_KEY e VITE_SUPABASE_URL no .env (local) ou nas variáveis do Vercel.',
    }
  }
  if (/ENOTFOUND|ECONNREFUSED|fetch failed|NetworkError|Failed to fetch|getaddrinfo|certificate/i.test(raw)) {
    return {
      status: 503,
      message: 'Não foi possível conectar ao banco de dados. Tente de novo em alguns instantes.',
    }
  }
  if (/webauthn_credentials|webauthn_challenges/i.test(raw) && /does not exist|42P01/i.test(raw)) {
    return {
      status: 503,
      message:
        'As tabelas de biometria ainda não existem no banco. No Supabase (SQL Editor), execute o arquivo scripts/migrations/13_webauthn.sql deste projeto.',
    }
  }
  if (/relation.*does not exist|42P01/i.test(raw)) {
    return {
      status: 503,
      message: 'Tabela de usuários não encontrada. Rode as migrations do Supabase neste projeto.',
    }
  }
  if (/permission denied for table|42501/i.test(raw)) {
    return {
      status: 503,
      message:
        'Acesso negado ao banco. Confira SUPABASE_SERVICE_ROLE_KEY (service role) no .env local ou no Vercel.',
    }
  }
  if (/PGRST116|multiple rows|more than one row/i.test(raw)) {
    return {
      status: 409,
      message: 'Existem registros duplicados para este e-mail. Contate o suporte.',
    }
  }
  if (/column .* does not exist|Could not find the .*column/i.test(raw)) {
    return {
      status: 503,
      message:
        'O banco está desatualizado em relação ao app. Rode as migrations em scripts/migrations/ no SQL Editor do Supabase.',
    }
  }
  if (/PGRST301|JWT expired|expired|timeout|ETIMEDOUT|connect ECONNREFUSED|socket hang up/i.test(raw)) {
    return {
      status: 503,
      message: 'Serviço de dados temporariamente indisponível. Tente de novo em alguns instantes.',
    }
  }
  return null
}

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
    log.error('webauthn list credentials', error)
    const mapped = mapSupabaseOrNetworkError(error)
    if (mapped) return c.json({ message: mapped.message }, mapped.status)
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
    log.error('webauthn delete credential', error)
    return c.json({ message: 'Não foi possível remover.' }, 500)
  }
})

app.get('/api/assinatura/status', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
    const perfil = await getPerfilUsuario(usuarioId)
    if (!perfil) return c.json({ message: 'Perfil não encontrado.' }, 404)
    const assinatura = await buildAssinaturaUsuarioPayload(usuarioId, perfil)
    return c.json(assinatura)
  } catch (error) {
    log.error('assinatura status failed', error)
    return c.json({
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
    })
  }
})

app.post('/api/assinatura/bem-vindo-visto', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
    await marcarBemVindoPagamentoVisto(usuarioId)
    const perfil = await getPerfilUsuario(usuarioId)
    if (!perfil) return c.json({ message: 'Perfil não encontrado.' }, 404)
    const assinatura = await buildAssinaturaUsuarioPayload(usuarioId, perfil)
    return c.json({ ok: true, ...assinatura })
  } catch (error) {
    log.error('bem-vindo-visto failed', error)
    return c.json({ message: 'Erro ao atualizar.' }, 500)
  }
})

app.post('/api/auth/request-password-reset', async (c) => {
  try {
    const ip = clientKeyFromHono(c)
    if (!rateLimitTake(`pw-req:${ip}`, 5, 15 * 60_000)) {
      return c.json({ message: 'Muitas solicitações. Tente de novo em alguns minutos.' }, 429)
    }
    const body = await c.req.json()
    const email = String(body?.email || '').trim().toLowerCase()

    if (!isValidEmail(email)) {
      return c.json({ message: 'Informe um e-mail válido.' }, 400)
    }

    const origin = getRequestOrigin(c)
    const result = await sendPasswordResetLink(email, origin)

    return c.json({
      message: 'Enviamos um link para seu e-mail.',
      devResetUrl: result.devResetUrl || null,
    })
  } catch (error) {
    log.error('request-password-reset failed', error)
    const mapped = mapSupabaseOrNetworkError(error)
    if (mapped) return c.json({ message: mapped.message }, mapped.status)
    return c.json(
      { message: 'Não foi possível enviar o link agora. Tente novamente em alguns instantes.' },
      500
    )
  }
})

app.post('/api/auth/reset-password', async (c) => {
  try {
    const ip = clientKeyFromHono(c)
    if (!rateLimitTake(`pw-reset:${ip}`, 20, 15 * 60_000)) {
      return c.json({ message: 'Muitas tentativas. Aguarde alguns minutos.' }, 429)
    }
    const body = await c.req.json()
    const token = String(body?.token || '').trim()
    const password = String(body?.password || '')

    if (!token) {
      return c.json({ message: 'Token inválido.' }, 400)
    }

    if (password.length < 6) {
      return c.json({ message: 'A senha deve ter no mínimo 6 caracteres.' }, 400)
    }

    const updated = await consumeResetToken(token, password)

    if (!updated) {
      return c.json({ message: 'Link inválido ou expirado.' }, 400)
    }

    return c.json({ message: 'Senha redefinida com sucesso.' })
  } catch (error) {
    log.error('reset-password failed', error)
    const mapped = mapSupabaseOrNetworkError(error)
    if (mapped) return c.json({ message: mapped.message }, mapped.status)
    return c.json({ message: 'Não foi possível redefinir a senha.' }, 500)
  }
})

// User preferences & profile
app.get('/api/usuarios/perfil', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    const perfil = await getPerfilUsuario(usuarioId)
    return c.json({ perfil })
  } catch (error) {
    log.error('get perfil failed', error)
    return c.json({ message: 'Erro ao buscar perfil.' }, 500)
  }
})

// Webhook Whatsapp (token também pode ir no path: /api/whatsapp/webhook/SEU_TOKEN)
app.post('/api/whatsapp/webhook/:pathToken', async (c) => {
  const result = await handleWhatsAppWebhook(c.req, { pathToken: c.req.param('pathToken') })
  return c.json(result.json, result.status)
})

app.post('/api/whatsapp/webhook', async (c) => {
  const result = await handleWhatsAppWebhook(c.req)
  return c.json(result.json, result.status)
})

app.get('/api/whatsapp/webhook', (c) => {
  return c.text('Webhook do WhatsApp está ativo! Utilize o método POST para enviar dados da plataforma.')
})

// Webhook Logs Admin (Simplified Admin route based on user ID checking logic for the future, right now just returning all)
app.get('/api/admin/whatsapp-status', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const status = await getWhatsappStatus()
    return c.json(status)
  } catch (error) {
    log.error('get admin status failed', error)
    return c.json({ message: 'Erro ao buscar status do whatsapp.' }, 500)
  }
})

app.get('/api/admin/whatsapp-logs', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const logs = await getWhatsappLogs()
    return c.json(logs)
  } catch (error) {
    log.error('get admin logs failed', error)
    return c.json({ message: 'Erro ao buscar logs do whatsapp.' }, 500)
  }
})

app.get('/api/admin/whatsapp-config', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const origin = getRequestOrigin(c).replace(/\/$/, '')
    const token = process.env.WHATSAPP_WEBHOOK_TOKEN || 'ece58f64012d51028d28a04264d07131'
    const enc = encodeURIComponent(token)
    return c.json({
      webhookUrlQuery: `${origin}/api/whatsapp/webhook?token=${enc}`,
      webhookUrlPath: `${origin}/api/whatsapp/webhook/${enc}`,
      hint:
        'Cole uma dessas URLs no painel Chipmassa/Telein (Webhook). Sem o token correto, mensagens com texto são rejeitadas.',
    })
  } catch (error) {
    log.error('get whatsapp config failed', error)
    return c.json({ message: 'Erro ao montar URL do webhook.' }, 500)
  }
})

app.get('/api/admin/usuarios', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const result = await listUsuariosAdminPaged({
      page: c.req.query('page'),
      pageSize: c.req.query('pageSize'),
      q: c.req.query('q'),
      role: c.req.query('role'),
      conta: c.req.query('conta'),
    })
    return c.json(result)
  } catch (error) {
    log.error('get admin usuarios failed', error)
    return c.json({ message: 'Erro ao listar usuários.' }, 500)
  }
})

app.get('/api/admin/audit-log', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const lim = c.req.query('limit')
    const rows = await listAdminAuditLog(parseInt(lim || '100', 10) || 100)
    return c.json(rows)
  } catch (error) {
    log.error('get admin audit-log failed', error)
    return c.json({ message: 'Erro ao listar auditoria.' }, 500)
  }
})

app.put('/api/admin/usuarios/:id', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const id = c.req.param('id')
    const body = await c.req.json()
    const updated = await updateUsuarioAdmin(id, body || {}, {
      actorUserId: usuarioId,
      clientIp: clientIpFromHono(c),
    })
    return c.json(updated)
  } catch (error) {
    log.error('update admin usuario failed', error)
    if (error.statusCode === 403 || error.statusCode === 404) {
      return c.json({ message: error.message }, error.statusCode)
    }
    const msg = error.code === '23505' ? 'E-mail ou telefone já utilizado em outra conta.' : 'Erro ao atualizar usuário.'
    return c.json({ message: msg }, 500)
  }
})

app.get('/api/admin/pagamentos', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const lim = Math.min(500, Math.max(1, parseInt(c.req.query('limit') || '200', 10) || 200))
    const rows = await listPagamentosAdmin(lim)
    return c.json(rows)
  } catch (error) {
    log.error('get admin pagamentos failed', error)
    return c.json({ message: 'Erro ao listar pagamentos.' }, 500)
  }
})

app.delete('/api/admin/pagamentos/pendentes', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const { deleted } = await deletePagamentosPendentesAdmin()
    return c.json({
      deleted,
      message: deleted === 0 ? 'Nenhum registro pendente para excluir.' : `${deleted} registro(s) pendente(s) excluído(s).`,
    })
  } catch (error) {
    log.error('delete admin pagamentos pendentes failed', error)
    return c.json({ message: 'Erro ao excluir logs pendentes.' }, 500)
  }
})

app.delete('/api/admin/usuarios/:id', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const id = c.req.param('id')
    await deleteUsuarioAdmin(id, { actorUserId: usuarioId, clientIp: clientIpFromHono(c) })
    return c.json({ message: 'Usuário excluído com sucesso.' })
  } catch (error) {
    log.error('delete admin usuario failed', error)
    if (error.statusCode === 403) {
      return c.json({ message: error.message }, 403)
    }
    return c.json({ message: 'Erro ao excluir usuário.' }, 500)
  }
})

app.post('/api/admin/usuarios/:id/solicitar-reset-senha', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const id = c.req.param('id')
    const perfil = await getPerfilUsuario(id)
    if (!perfil?.email) return c.json({ message: 'Usuário não encontrado.' }, 404)

    const origin = getRequestOrigin(c)
    const result = await sendPasswordResetLink(perfil.email, origin)

    await insertAdminAuditLog({
      actorUserId: usuarioId,
      action: 'reset_senha_solicitado',
      targetUserId: id,
      targetEmail: perfil.email,
      clientIp: clientIpFromHono(c),
    })

    return c.json({
      message: 'Se o e-mail existir no cadastro, enviamos o link de redefinição.',
      devResetUrl: result.devResetUrl || null,
    })
  } catch (error) {
    log.error('admin solicitar-reset-senha failed', error)
    if (error.statusCode === 400) {
      return c.json({ message: error.message }, 400)
    }
    const mapped = mapSupabaseOrNetworkError(error)
    if (mapped) return c.json({ message: mapped.message }, mapped.status)
    return c.json({ message: 'Erro ao solicitar redefinição.' }, 500)
  }
})

// Transaction and Category Routes

app.get('/api/categorias', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    const data = await getCategorias(usuarioId)
    return c.json(data)
  } catch (error) {
    log.error('get categories failed', error)
    return c.json({ message: 'Erro ao buscar categorias.' }, 500)
  }
})

app.get('/api/transacoes', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    const listQ = validateTransacoesListQuery({
      limit: c.req.query('limit'),
      offset: c.req.query('offset'),
    })
    if (!listQ.ok) {
      return c.json({ message: listQ.message }, 400)
    }

    const ip = clientKeyFromHono(c)
    if (!rateLimitTake(`tx-list:${usuarioId}:${ip}`, 240, 60_000)) {
      return c.json({ message: 'Muitas consultas. Aguarde um momento.' }, 429)
    }

    const qOff = c.req.query('offset')
    const filters = {
      dataInicio: c.req.query('dataInicio'),
      dataFim: c.req.query('dataFim'),
      tipo: c.req.query('tipo'),
      categoria_id: c.req.query('categoria_id'),
      status: c.req.query('status'),
      busca: c.req.query('busca'),
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')) : undefined,
      offset: qOff !== undefined && qOff !== '' ? parseInt(String(qOff), 10) : undefined,
    }

    const data = await getTransacoes(usuarioId, filters)
    return c.json(data)
  } catch (error) {
    log.error('get transactions failed', error)
    return c.json({ message: 'Erro ao buscar transações.' }, 500)
  }
})

app.post('/api/transacoes', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    if (!rateLimitTake(`tx-mut:${usuarioId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
      return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
    }

    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ message: 'JSON inválido.' }, 400)
    }

    const val = validateNovaTransacaoBody(body)
    if (!val.ok) {
      return c.json({ message: val.message }, 400)
    }

    // Vincula o usuario logado
    body.usuario_id = usuarioId

    let data = await inserirTransacao(body)

    const rawDia1 = body.recorrencia_dia_1
    const marcaRecorrenciaDia1 =
      rawDia1 === true ||
      rawDia1 === 'true' ||
      rawDia1 === 1 ||
      rawDia1 === '1'
    const querRecorrenciaDia1 =
      marcaRecorrenciaDia1 &&
      !(body.recorrencia && Number(body.recorrencia.quantidade) > 1)
    if (querRecorrenciaDia1 && data) {
      try {
        const { transacaoAtualizada } = await criarRegraRecorrenciaDia1(usuarioId, data)
        if (transacaoAtualizada?.recorrencia_mensal_id) {
          data = { ...data, recorrencia_mensal_id: transacaoAtualizada.recorrencia_mensal_id }
        }
      } catch (e) {
        log.error('criar regra recorrência dia 1', e)
        /* transação já foi gravada; regra pode ter sido revertida no servidor */
      }
    }

    return c.json({ message: 'Transação inserida com sucesso.', data }, 201)
  } catch (error) {
    log.error('insert transaction failed', error)
    return c.json({ message: error.message || 'Erro ao inserir transação.' }, 500)
  }
})

app.post('/api/recorrencias-mensais/sincronizar', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    const result = await processarRecorrenciasPendentes(usuarioId)
    return c.json(result)
  } catch (error) {
    log.error('sincronizar recorrências mensais', error)
    return c.json({ message: error.message || 'Erro ao sincronizar.' }, 500)
  }
})

app.get('/api/recorrencias-mensais', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    const data = await listarRecorrenciasMensais(usuarioId)
    return c.json(data)
  } catch (error) {
    log.error('listar recorrências mensais', error)
    return c.json({ message: error.message || 'Erro ao listar.' }, 500)
  }
})

app.delete('/api/recorrencias-mensais/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    await desativarRecorrenciaMensal(id, usuarioId)
    return c.json({ message: 'Recorrência encerrada.' })
  } catch (error) {
    log.error('desativar recorrência mensal', error)
    return c.json({ message: error.message || 'Erro ao encerrar.' }, 500)
  }
})

app.get('/api/cron/recorrencias-mensais', async (c) => {
  const auth = assertCronSecret(c)
  if (!auth.ok) {
    return c.json({ message: auth.message }, auth.status)
  }
  try {
    const result = await processarRecorrenciasPendentes(null)
    return c.json({ ok: true, ...result })
  } catch (error) {
    log.error('cron recorrências mensais', error)
    return c.json({ message: error.message || 'Erro no cron.' }, 500)
  }
})

app.put('/api/transacoes/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    if (!isUuidString(id)) {
      return c.json({ message: 'ID inválido.' }, 400)
    }

    if (!rateLimitTake(`tx-mut:${usuarioId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
      return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
    }

    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ message: 'JSON inválido.' }, 400)
    }

    const vBody = validateAtualizacaoTransacaoBody(body)
    if (!vBody.ok) {
      return c.json({ message: vBody.message }, 400)
    }

    await atualizarTransacao(id, usuarioId, body)
    return c.json({ message: 'Transação atualizada com sucesso.' })
  } catch (error) {
    log.error('update transaction failed', error)
    return c.json({ message: error.message || 'Erro ao atualizar transação.' }, 500)
  }
})

app.delete('/api/transacoes/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    if (!isUuidString(id)) {
      return c.json({ message: 'ID inválido.' }, 400)
    }

    if (!rateLimitTake(`tx-mut:${usuarioId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
      return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
    }

    await deletarTransacao(id, usuarioId)
    return c.json({ message: 'Transação excluída com sucesso.' })
  } catch (error) {
    log.error('delete transaction failed', error)
    return c.json({ message: 'Erro ao excluir transação.' }, 500)
  }
})

// AI Chat Route — Pergunte ao Horizon

// Mercado Pago — checkout e notificações
app.get('/api/pagamentos/config', async (c) => {
  const pk = getMercadoPagoPublicKey()
  let isento_pagamento = false
  const uid = c.req.header('x-user-id')
  if (uid) {
    try {
      const perfil = await getPerfilUsuario(uid)
      isento_pagamento = perfil?.isento_pagamento === true
    } catch {
      /* ignore */
    }
  }
  return c.json({
    publicKey: pk || null,
    ready: isMercadoPagoConfigured(),
    isento_pagamento,
  })
})

app.get('/api/pagamentos/minhas', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
    await sincronizarPagamentosPendentesDoUsuario(usuarioId)
    await sincronizarPreapprovalUsuario(usuarioId).catch(() => {})
    const rows = await listPagamentosUsuario(usuarioId)
    return c.json(rows)
  } catch (error) {
    log.error('list pagamentos failed', error)
    return c.json({ message: 'Erro ao listar pagamentos.' }, 500)
  }
})

app.post('/api/pagamentos/preferencia', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
    const ip = clientKeyFromHono(c)
    if (!rateLimitTake(`mp-pref:${usuarioId}:${ip}`, 15, 60 * 60_000)) {
      return c.json({ message: 'Limite de solicitações de pagamento. Tente de novo em até uma hora.' }, 429)
    }
    if (!isMercadoPagoConfigured()) {
      return c.json({ message: 'Pagamentos não configurados no servidor (MERCADO_PAGO_ACCESS_TOKEN).' }, 503)
    }

    const body = await c.req.json().catch(() => ({}))
    const titulo = String(body?.titulo || 'Assinatura Horizonte Financeiro').trim() || 'Assinatura Horizonte Financeiro'
    const valorRaw = body?.valor
    const defaultPreco = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10')
    const valor = Number(valorRaw != null && valorRaw !== '' ? valorRaw : defaultPreco)
    if (!Number.isFinite(valor) || valor <= 0) {
      return c.json({ message: 'Valor inválido.' }, 400)
    }

    const perfil = await getPerfilUsuario(usuarioId)
    if (!perfil?.email) {
      return c.json({ message: 'Perfil sem e-mail. Atualize seu cadastro.' }, 400)
    }
    if (perfil.isento_pagamento === true) {
      return c.json({
        message: 'Sua conta está marcada como isenta de pagamento. Não é necessário concluir o checkout.',
      }, 403)
    }

    const baseUrl = getRequestOrigin(c).replace(/\/+$/, '')
    const externalRef = `hf-${randomUUID()}`

    const pre = await criarPreapprovalAssinaturaMensal({
      baseUrl,
      usuarioId,
      email: perfil.email,
      title: `${titulo} (mensal)`,
      unitPrice: valor,
      externalReference: externalRef,
    })

    await insertPreferenciaRecord({
      usuario_id: usuarioId,
      preference_id: null,
      preapproval_id: String(pre.id),
      external_reference: externalRef,
      amount: valor,
      description: `${titulo} — assinatura mensal`,
    })

    await atualizarUsuarioDePreapprovalResponse(usuarioId, {
      id: pre.id,
      status: pre.status,
      next_payment_date: pre.next_payment_date,
      metadata: { usuario_id: usuarioId },
    })

    const token = getMercadoPagoAccessToken()
    const useSandbox = useSandboxCheckout(token)

    return c.json({
      preapproval_id: pre.id,
      preference_id: null,
      init_point: pre.init_point,
      sandbox_init_point: pre.sandbox_init_point,
      use_sandbox: useSandbox,
    })
  } catch (error) {
    log.error('criar preferencia mp failed', error)
    return c.json({ message: error.message || 'Erro ao criar pagamento.' }, 500)
  }
})

/** Mercado Pago envia notificações (IPN / webhooks). Responda 200 rápido. */
app.get('/api/pagamentos/webhook', (c) => c.json({ ok: true }))

app.post('/api/pagamentos/webhook', async (c) => {
  let paymentId = null
  let preapprovalWebhookId = null
  let qsTopic = ''
  try {
    const url = new URL(c.req.url)
    qsTopic = (url.searchParams.get('topic') || url.searchParams.get('type') || '').toLowerCase()
    const qsId = url.searchParams.get('id') || url.searchParams.get('data.id')
    if (qsTopic === 'payment' && qsId) paymentId = String(qsId)
    if (
      (qsTopic === 'preapproval' || qsTopic === 'subscription_preapproval' || qsTopic === 'subscription') &&
      qsId
    ) {
      preapprovalWebhookId = String(qsId)
    }

    const ct = c.req.header('content-type') || ''
    if (ct.includes('application/json')) {
      const body = await c.req.json().catch(() => ({}))
      const t = String(body?.type || body?.topic || body?.action || '').toLowerCase()
      if (!paymentId && body?.data?.id != null && t === 'payment') {
        paymentId = String(body.data.id)
      }
      if (!paymentId && body?.id && (t === 'payment' || String(body?.topic || '').toLowerCase() === 'payment')) {
        paymentId = String(body.id)
      }
      if (!paymentId && body?.data?.id != null) {
        const action = String(body?.action || '').toLowerCase()
        if (action.includes('payment')) paymentId = String(body.data.id)
      }
      if (
        !preapprovalWebhookId &&
        (t === 'preapproval' || t === 'subscription_preapproval' || t === 'subscription')
      ) {
        const pid = body?.data?.id ?? body?.id
        if (pid != null) preapprovalWebhookId = String(pid)
      }
    } else if (!paymentId && !preapprovalWebhookId) {
      const text = await c.req.text()
      if (text) {
        const params = new URLSearchParams(text)
        const tp = (params.get('topic') || '').toLowerCase()
        if (tp === 'payment' && params.get('id')) paymentId = String(params.get('id'))
        if ((tp === 'preapproval' || tp === 'subscription_preapproval') && params.get('id')) {
          preapprovalWebhookId = String(params.get('id'))
        }
      }
    }
  } catch (e) {
    logMpWebhook({ stage: 'parse_error', err: errorToText(e) })
    log.error('[MP webhook] parse', e)
  }

  logMpWebhook({
    stage: 'received',
    topic: qsTopic || undefined,
    payment_id: paymentId || undefined,
    preapproval_id: preapprovalWebhookId || undefined,
  })

  if (preapprovalWebhookId) {
    try {
      await sincronizarPreapprovalPorIdFromWebhook(preapprovalWebhookId)
      logMpWebhook({ stage: 'preapproval_ok', preapproval_id: preapprovalWebhookId })
    } catch (e) {
      logMpWebhook({ stage: 'preapproval_error', preapproval_id: preapprovalWebhookId, err: errorToText(e) })
      log.error('[MP webhook] preapproval', e)
    }
    return c.json({ ok: true })
  }

  if (!paymentId) {
    return c.json({ received: true })
  }

  try {
    const payment = await buscarPagamentoPorId(paymentId)
    const extRef =
      payment?.external_reference != null
        ? String(payment.external_reference)
        : payment?.metadata?.external_reference != null
          ? String(payment.metadata.external_reference)
          : undefined
    logMpWebhook({
      stage: 'payment_fetch_ok',
      payment_id: paymentId,
      external_reference: extRef,
      status: payment?.status != null ? String(payment.status) : undefined,
    })
    await upsertFromWebhookPayment(payment)
    logMpWebhook({ stage: 'payment_upsert_ok', payment_id: paymentId })
  } catch (e) {
    logMpWebhook({ stage: 'payment_error', payment_id: paymentId, err: errorToText(e) })
    log.error('[MP webhook] process', e)
  }

  return c.json({ ok: true })
})

app.post('/api/ai/chat', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    const body = await c.req.json()
    const message = String(body?.message || '').trim()
    const historico = Array.isArray(body?.historico) ? body.historico : []

    if (!message) {
      return c.json({ message: 'Mensagem não pode estar vazia.' }, 400)
    }

    const resposta = await askHorizon(message, usuarioId, historico)

    return c.json({ resposta })
  } catch (error) {
    log.error('ai chat failed', error)
    const msg = error.message?.includes('GEMINI_API_KEY')
      ? 'Chave de API do Gemini não configurada. Adicione GEMINI_API_KEY no .env do servidor.'
      : 'Não foi possível processar sua pergunta agora. Tente novamente.'
    return c.json({ message: msg }, 500)
  }
})

export default app

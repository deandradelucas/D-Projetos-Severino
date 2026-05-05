import { randomUUID } from 'node:crypto'
import { HTTPException } from 'hono/http-exception'
import { log } from './lib/logger.mjs'
import { cors } from 'hono/cors'
import { createApp } from './app-factory.mjs'
import { httpRequestLogger, pagamentosRequestLogger } from './middleware/request-logger.mjs'
import { clientIpFromHono } from './lib/http/client-ip.mjs'
import { getSupabaseAdmin } from './lib/supabase-admin.mjs'
import { authenticateUser, getRequestOrigin, isValidEmail } from './lib/password-reset.mjs'
import { sendEvolutionText } from './lib/evolution-send.mjs'
import { requestPasswordOtpWhatsApp, confirmPasswordOtpWhatsApp } from './lib/password-otp-whatsapp.mjs'
import {
  getCategorias,
  getTransacoes,
  atualizarTransacao,
  deletarTransacao,
} from './lib/transacoes.mjs'

import {
  assertCronSecret,
  desativarRecorrenciaMensal,
  listarRecorrenciasMensais,
  processarRecorrenciasPendentes,
} from './lib/recorrencias-mensais.mjs'
import {
  getPerfilUsuario,
  listUsuariosAdminPaged,
  updateUsuarioAdmin,
  deleteUsuarioAdmin,
} from './lib/usuarios.mjs'
import { insertAdminAuditLog, listAdminAuditLog } from './lib/admin-audit.mjs'
import {
  askHorizon,
  transcribeWhatsAppAudioWithGemini,
  parseAgendaFromTextWithAI,
  parseWhatsAppMessageWithAI,
} from './lib/ai.mjs'
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
  listPagamentosAdminPayload,
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
import { TransactionService } from './lib/services/transaction-service.mjs'
import { assertBotSecret, processarMensagemBot } from './lib/domain/whatsapp-bot.mjs'
import healthRoutes from './routes/health.mjs'
import {
  atualizarAgendaEvento,
  atualizarAgendaStatus,
  criarAgendaEvento,
  deletarAgendaEvento,
  claimLembreteAgenda,
  listarAgendaEventos,
  listarEMarcarLembretesPendentes,
  registrarFalhaLembreteAgenda,
  registrarLembretesAgendaEnviados,
} from './lib/domain/agenda.mjs'

loadEnv()

const app = createApp()

function assertAgendaReminderSecret(c) {
  const expected = process.env.AGENDA_REMINDER_SECRET || process.env.WHATSAPP_BOT_SECRET
  if (!expected || String(expected).trim() === '') {
    log.warn('[agenda] AGENDA_REMINDER_SECRET/WHATSAPP_BOT_SECRET não configurado')
    return { ok: false, status: 503, message: 'Agenda WhatsApp não configurada.' }
  }
  const auth = c.req.header('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const header = c.req.header('x-agenda-reminder-secret') || ''
  if (bearer === expected || header === expected) return { ok: true }
  return { ok: false, status: 401, message: 'Não autorizado.' }
}

function assertAgendaCronSecret(c) {
  const allowed = [
    process.env.CRON_SECRET,
    process.env.AGENDA_REMINDER_SECRET,
    process.env.WHATSAPP_BOT_SECRET,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  if (!allowed.length) {
    log.warn('[agenda-cron] nenhum segredo configurado')
    return { ok: false, status: 503, message: 'Cron de agenda não configurado.' }
  }

  const auth = c.req.header('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const headers = [bearer, c.req.header('x-cron-secret'), c.req.header('x-agenda-reminder-secret')]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  if (headers.some((value) => allowed.includes(value))) return { ok: true }

  return { ok: false, status: 401, message: 'Não autorizado.' }
}

function parseJsonEnv(value) {
  try {
    return value ? JSON.parse(value) : {}
  } catch {
    return {}
  }
}

function base64ToBuffer(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const clean = raw.includes(',') ? raw.split(',').pop() : raw
  return Buffer.from(clean, 'base64')
}

function firstString(...values) {
  for (const value of values) {
    const s = String(value || '').trim()
    if (s) return s
  }
  return ''
}

function extractBase64FromEvolutionResponse(data) {
  return firstString(
    data?.base64,
    data?.media,
    data?.base64Data,
    data?.data?.base64,
    data?.data?.media,
    data?.data?.base64Data,
    data?.file?.base64,
    data?.message?.base64
  )
}

async function audioBufferFromEvolutionMedia(body) {
  const messageId = firstString(
    body?.messageId,
    body?.audioMessageId,
    body?.rawEvolutionData?.data?.key?.id,
    body?.rawEvolutionData?.key?.id,
    body?.rawEvolutionData?.id
  )
  const baseUrl = firstString(process.env.EVOLUTION_API_URL, process.env.EVOLUTION_SERVER_URL)
  const instance = firstString(
    body?.evolutionInstance,
    body?.instance,
    body?.rawEvolutionData?.instance,
    body?.rawEvolutionData?.data?.instance,
    process.env.EVOLUTION_INSTANCE
  )
  const apiKey = firstString(body?.evolutionApiKey, process.env.EVOLUTION_API_KEY)

  if (!messageId || !baseUrl || !instance || !apiKey) return null

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: { key: { id: messageId } },
      convertToMp4: false,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`Evolution getBase64 ${response.status}: ${String(data?.message || data?.error || '').slice(0, 220)}`)
  }

  const b64 = extractBase64FromEvolutionResponse(data)
  return base64ToBuffer(b64)
}

async function audioBufferFromWhatsAppBody(body) {
  const direct = base64ToBuffer(body?.audioBase64 || body?.base64 || body?.mediaBase64)
  if (direct?.length) return direct

  const fromEvolution = await audioBufferFromEvolutionMedia(body)
  if (fromEvolution?.length) return fromEvolution

  const audioUrl = String(body?.audioUrl || body?.mediaUrl || body?.url || '').trim()
  if (!audioUrl) return null

  const headers = {
    ...parseJsonEnv(process.env.WHATSAPP_MEDIA_FETCH_HEADERS),
    ...(body?.mediaHeaders && typeof body.mediaHeaders === 'object' ? body.mediaHeaders : {}),
  }
  const evolutionKey = body?.evolutionApiKey || process.env.EVOLUTION_API_KEY
  if (evolutionKey && !headers.apikey) headers.apikey = String(evolutionKey)

  const response = await fetch(audioUrl, { headers })
  if (!response.ok) {
    throw new Error(`Falha ao baixar áudio (${response.status}).`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function claimWhatsAppInboundMessage(body, phone) {
  const messageId = firstString(
    body?.messageId,
    body?.rawEvolutionData?.data?.key?.id,
    body?.rawEvolutionData?.key?.id,
    body?.rawEvolutionData?.id
  )
  if (!messageId) return true

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('whatsapp_logs').insert({
    telefone_remetente: String(phone || '').slice(0, 64),
    mensagem_recebida: `whatsapp_message:${messageId}`.slice(0, 1000),
    status: 'WHATSAPP_RECEBIDO',
    detalhe_erro: null,
  })

  if (!error) return true
  if (error.code === '23505') return false
  throw error
}

async function processWhatsappBotBody(body, options = {}) {
  const phone = String(body?.phone || '').replace(/\D/g, '')
  let message = String(body?.message || body?.text || body?.transcription || '').trim()
  let inputType = 'text'

  const claimed = await claimWhatsAppInboundMessage(body, phone)
  if (!claimed) {
    return { status: 200, response: { ok: true, duplicate: true, reply: '' } }
  }

  if (!message && (body?.audioBase64 || body?.base64 || body?.mediaBase64 || body?.audioUrl || body?.mediaUrl || body?.url || body?.messageId)) {
    const audioBuffer = await audioBufferFromWhatsAppBody(body)
    if (!audioBuffer?.length) {
      return {
        status: 400,
        response: { ok: false, reply: '🎙️ Não consegui receber o áudio. Tente enviar novamente.' },
      }
    }
    message = (await transcribeWhatsAppAudioWithGemini(audioBuffer, body?.mimeType || body?.mimetype || 'audio/ogg')).trim()
    inputType = 'audio'
  }

  if (!phone || !message) {
    return { status: 400, response: { message: 'phone e message ou áudio são obrigatórios.' } }
  }

  const result = await processarMensagemBot(phone, message)
  const whatsappOutboundSent = await deliverWhatsappBotOutbound(body, phone, result, options)
  return {
    status: 200,
    response: {
      ...result,
      inputType,
      transcript: inputType === 'audio' ? message : undefined,
      whatsappOutboundSent,
    },
  }
}

function buildBotBodyFromEvolutionPayload(payload) {
  const data = payload?.data || payload || {}
  const key = data.key || {}
  const remoteJid = String(key.remoteJid || '')
  if (!remoteJid || remoteJid.endsWith('@g.us') || key.fromMe) return null

  const msg = data.message || {}
  const audio = msg.audioMessage || msg.pttMessage || {}
  const listRowId = msg.listResponseMessage?.singleSelectReply?.selectedRowId
  const buttonId = firstString(msg.buttonsResponseMessage?.selectedButtonId, msg.buttonsResponseMessage?.selectedDisplayText)
  const text = firstString(
    listRowId,
    buttonId,
    msg.conversation,
    msg.extendedTextMessage?.text,
    msg.imageMessage?.caption,
    msg.videoMessage?.caption,
    audio.caption,
    audio.transcription,
    audio.text,
    data.transcription
  )
  const messageId = firstString(key.id, data.id)
  const hasAudio = Boolean(audio.url || audio.mediaUrl || audio.media_url || data.mediaUrl || data.audioUrl || data.url || audio.base64 || data.base64 || data.audioBase64 || messageId && (msg.audioMessage || msg.pttMessage))

  if (!text && !hasAudio) return null

  return {
    phone: remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, ''),
    message: text,
    audioUrl: firstString(audio.url, audio.mediaUrl, audio.media_url, data.mediaUrl, data.audioUrl, data.url),
    audioBase64: firstString(audio.base64, data.base64, data.audioBase64),
    mimeType: firstString(audio.mimetype, audio.mimeType, data.mimetype, data.mimeType, 'audio/ogg'),
    messageId,
    evolutionInstance: firstString(data.instance, payload?.instance),
    rawEvolutionData: { data },
  }
}

/** Remove sufixo legado ou injetado por automação (ex.: "Responda: confirmar …"). */
function stripRespondaAgendaReminderSuffix(text) {
  if (!text || typeof text !== 'string') return text
  return text.replace(/\s*Responda\s*:\s*[\s\S]*$/i, '').trimEnd()
}

/**
 * Envia resposta no WhatsApp via Evolution quando há instância resolvida.
 * Com `evolutionEnvFallback: true`, usa `EVOLUTION_INSTANCE` se o body não trouxer instância.
 */
async function deliverWhatsappBotOutbound(body, phone, response, options = {}) {
  if (!response || typeof response !== 'object' || !phone) return false
  const instance = firstString(
    body?.evolutionInstance,
    body?.instance,
    options.evolutionEnvFallback ? process.env.EVOLUTION_INSTANCE : undefined,
  )
  if (!instance) return false

  const textToSend = String(response.reply || '').trim()

  try {
    if (!textToSend) return false
    const textOk = await sendEvolutionText({ instance, number: phone, text: textToSend })
    return Boolean(textOk)
  } catch (e) {
    log.error('[whatsapp] deliverWhatsappBotOutbound', e)
    return false
  }
}

async function processAgendaReminderCron({ limit = 80 } = {}) {
  const result = await listarEMarcarLembretesPendentes({ limit, marcarComoEnviado: false })
  const mensagens = Array.isArray(result?.mensagens) ? result.mensagens : []
  const sent = []
  const failed = []

  for (const item of mensagens) {
    const claimed = await claimLembreteAgenda(item)
    if (!claimed) continue

    try {
      const okText = await sendEvolutionText({
        instance: process.env.EVOLUTION_INSTANCE,
        number: item.phone,
        text: stripRespondaAgendaReminderSuffix(item.message),
      })
      if (!okText) throw new Error('Evolution sendText falhou.')
      await registrarLembretesAgendaEnviados([item])
      sent.push(item.reminder_id)
    } catch (error) {
      await registrarFalhaLembreteAgenda(item, error?.message || 'Falha ao enviar lembrete.')
      failed.push({ reminder_id: item.reminder_id, error: error?.message || 'Falha ao enviar lembrete.' })
      log.error('[agenda-cron] send reminder failed', {
        reminder_id: item.reminder_id,
        event_id: item.event_id,
        user_id: item.user_id,
        error: error?.message || error,
      })
    }
  }

  return {
    ok: failed.length === 0,
    total: mensagens.length,
    sent: sent.length,
    failed: failed.length,
    failures: failed.slice(0, 5),
  }
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

app.use('*', httpRequestLogger)

app.use('/api/pagamentos/*', pagamentosRequestLogger)

app.route('/api', healthRoutes)

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
  if (
    /Missing Supabase URL \(VITE_SUPABASE_URL or SUPABASE_URL\)/i.test(raw) ||
    /Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/i.test(raw)
  ) {
    return {
      status: 503,
      message:
        'Banco de dados não configurado. Em desenvolvimento, crie um arquivo .env na raiz com VITE_SUPABASE_URL (ou SUPABASE_URL no servidor) e SUPABASE_SERVICE_ROLE_KEY (copie de env.example). No Vercel, defina as mesmas variáveis no projeto e faça um novo deploy.',
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
  if (
    /webauthn_credentials|webauthn_challenges/i.test(raw) &&
    /does not exist|42P01|Could not find the table|PGRST205|schema cache/i.test(raw)
  ) {
    return {
      status: 503,
      message:
        'As tabelas de biometria ainda não existem no banco. No Supabase (SQL Editor), execute o arquivo scripts/migrations/13_webauthn.sql deste projeto.',
    }
  }
  if (/relation.*does not exist|42P01|PGRST205|Could not find the table.*schema cache/i.test(raw)) {
    return {
      status: 503,
      message:
        'Tabela ou recurso não encontrado no banco. Rode os scripts em scripts/migrations/ no SQL Editor do Supabase (neste projeto).',
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
  if (/PGRST100|PGRST102|failed to parse|parse.*filter|invalid.*filter/i.test(raw)) {
    return {
      status: 503,
      message:
        'A consulta ao banco foi rejeitada (filtro inválido). Se acabou de atualizar o app, faça um deploy recente; senão, verifique os logs do servidor.',
    }
  }
  if (/PGRST301|JWT expired|expired|timeout|ETIMEDOUT|connect ECONNREFUSED|socket hang up/i.test(raw)) {
    return {
      status: 503,
      message: 'Serviço de dados temporariamente indisponível. Tente de novo em alguns instantes.',
    }
  }
  if (
    /generativelanguage\.googleapis\.com|Gemini API|RESOURCE_EXHAUSTED|quota exceeded|429.*generateContent/i.test(
      raw,
    )
  ) {
    return {
      status: 503,
      message:
        'O serviço de inteligência artificial está temporariamente indisponível ou sem quota. Tente novamente em alguns minutos.',
    }
  }
  if (/api\.mercadopago\.com|Mercado\s*Pago|mercadopago/i.test(raw) && /ECONNRESET|ETIMEDOUT|5\d\d|fetch failed/i.test(raw)) {
    return {
      status: 503,
      message: 'O gateway de pagamentos está indisponível no momento. Tente novamente em instantes.',
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
      assinatura: c.req.query('assinatura'),
      login: c.req.query('login'),
      createdFrom: c.req.query('createdFrom'),
      createdTo: c.req.query('createdTo'),
      accessFrom: c.req.query('accessFrom'),
      accessTo: c.req.query('accessTo'),
      payFrom: c.req.query('payFrom'),
      payTo: c.req.query('payTo'),
      trialEndsFrom: c.req.query('trialEndsFrom'),
      trialEndsTo: c.req.query('trialEndsTo'),
      sort: c.req.query('sort'),
    })
    return c.json(result)
  } catch (error) {
    log.error('get admin usuarios failed', error)
    const mapped = mapSupabaseOrNetworkError(error)
    if (mapped) return c.json({ message: mapped.message }, mapped.status)
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

    const lim = Math.min(800, Math.max(1, parseInt(c.req.query('limit') || '500', 10) || 500))
    const statusGroup = c.req.query('statusGroup') || 'all'
    const q = c.req.query('q') || ''
    const dateFrom = c.req.query('dateFrom') || ''
    const dateTo = c.req.query('dateTo') || ''
    const sort = c.req.query('sort') || 'created_desc'
    const exempt = c.req.query('exempt') || 'all'
    const overdueOnly = c.req.query('overdueOnly') || ''

    const payload = await listPagamentosAdminPayload({
      limit: lim,
      statusGroup,
      q,
      dateFrom,
      dateTo,
      sort,
      exempt,
      overdueOnly,
    })
    return c.json(payload)
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

app.post('/api/admin/usuarios/:id/solicitar-otp-senha-whatsapp', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    const block = await assertPrincipalAdmin(usuarioId)
    if (block) return c.json({ message: block.message }, block.status)

    const id = c.req.param('id')
    const perfil = await getPerfilUsuario(id)
    if (!perfil?.email) return c.json({ message: 'Usuário não encontrado.' }, 404)

    const ip = clientKeyFromHono(c)
    if (!rateLimitTake(`admin-pw-otp:${usuarioId}:${ip}`, 25, 60 * 60_000)) {
      return c.json({ message: 'Limite de solicitações. Tente mais tarde.' }, 429)
    }

    const result = await requestPasswordOtpWhatsApp(perfil.email, { detailedErrors: true })
    await insertAdminAuditLog({
      actorUserId: usuarioId,
      action: 'reset_senha_otp_whatsapp',
      targetUserId: id,
      targetEmail: perfil.email,
      clientIp: clientIpFromHono(c),
    })
    return c.json({ message: result.message })
  } catch (error) {
    log.error('admin solicitar-otp-senha-whatsapp failed', error)
    const status = error.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500
    if (status !== 500) {
      return c.json({ message: error.message || 'Solicitação inválida.' }, status)
    }
    const mapped = mapSupabaseOrNetworkError(error)
    if (mapped) return c.json({ message: mapped.message }, mapped.status)
    return c.json({ message: 'Erro ao solicitar código pelo WhatsApp.' }, 500)
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
      somenteRecorrentes: c.req.query('recorrentes') === '1',
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

    // Vincula o usuario logado e processa via serviço
    const data = await TransactionService.createTransaction(usuarioId, body)

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

app.get('/api/agenda', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    const data = await listarAgendaEventos(usuarioId, {
      from: c.req.query('from'),
      to: c.req.query('to'),
      status: c.req.query('status'),
      incluirCancelados: c.req.query('incluirCancelados') === '1',
    })
    return c.json(data)
  } catch (error) {
    log.error('listar agenda', error)
    return c.json({ message: error.message || 'Erro ao listar agenda.' }, 500)
  }
})

app.post('/api/agenda', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    if (!rateLimitTake(`agenda-mut:${usuarioId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
      return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
    }

    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ message: 'JSON inválido.' }, 400)
    }

    const data = await criarAgendaEvento(usuarioId, body, 'APP')
    return c.json({ message: 'Compromisso criado.', data }, 201)
  } catch (error) {
    log.error('criar agenda', error)
    return c.json({ message: error.message || 'Erro ao criar compromisso.' }, 500)
  }
})

app.put('/api/agenda/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
    if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    if (!rateLimitTake(`agenda-mut:${usuarioId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
      return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
    }

    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ message: 'JSON inválido.' }, 400)
    }

    const data = await atualizarAgendaEvento(id, usuarioId, body)
    return c.json({ message: 'Compromisso atualizado.', data })
  } catch (error) {
    log.error('atualizar agenda', error)
    return c.json({ message: error.message || 'Erro ao atualizar compromisso.' }, 500)
  }
})

app.patch('/api/agenda/:id/status', async (c) => {
  try {
    const id = c.req.param('id')
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
    if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ message: 'JSON inválido.' }, 400)
    }

    const data = await atualizarAgendaStatus(id, usuarioId, body?.status)
    return c.json({ message: 'Status atualizado.', data })
  } catch (error) {
    log.error('status agenda', error)
    return c.json({ message: error.message || 'Erro ao atualizar status.' }, 500)
  }
})

app.delete('/api/agenda/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
    if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    await deletarAgendaEvento(id, usuarioId)
    return c.json({ message: 'Compromisso removido.' })
  } catch (error) {
    log.error('remover agenda', error)
    return c.json({ message: error.message || 'Erro ao remover compromisso.' }, 500)
  }
})

app.post('/api/agenda/lembretes/pendentes', async (c) => {
  const auth = assertAgendaReminderSecret(c)
  if (!auth.ok) return c.json({ message: auth.message }, auth.status)

  try {
    let body = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }
    const result = await listarEMarcarLembretesPendentes({
      limit: body?.limit,
      janelaMinutos: body?.janelaMinutos,
    })
    return c.json(result)
  } catch (error) {
    log.error('agenda lembretes pendentes', error)
    return c.json({ message: error.message || 'Erro ao buscar lembretes.' }, 500)
  }
})

app.get('/api/cron/agenda-lembretes', async (c) => {
  const auth = assertAgendaCronSecret(c)
  if (!auth.ok) return c.json({ message: auth.message }, auth.status)

  try {
    const result = await processAgendaReminderCron({ limit: 80 })
    log.info('[agenda-cron] processed reminders', result)
    return c.json(result)
  } catch (error) {
    log.error('cron agenda lembretes', error)
    return c.json({ message: error.message || 'Erro no cron de lembretes.' }, 500)
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
    const raw = String(error?.message || '')
    if (raw.includes('GEMINI_API_KEY') || /GEMINI_API_KEY não configurada/i.test(raw)) {
      return c.json(
        {
          message:
            'Chave de API do Gemini não configurada. Adicione GEMINI_API_KEY no .env do servidor.',
        },
        500,
      )
    }
    if (raw.includes('filtro de segurança')) {
      return c.json({ message: raw }, 422)
    }
    if (
      /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|invalid\s*API\s*key|API\s*key\s*not\s*valid/i.test(
        raw,
      )
    ) {
      return c.json(
        {
          message:
            'A chave GEMINI_API_KEY é inválida ou foi revogada. Crie uma nova em https://aistudio.google.com/app/apikey e atualize o servidor (.env ou variáveis no Vercel).',
        },
        503,
      )
    }
    if (/quota|RESOURCE_EXHAUSTED|exceeded your current quota|429/i.test(raw)) {
      return c.json(
        {
          message:
            'Limite de uso da API Gemini atingido. Aguarde alguns minutos ou verifique o plano em Google AI Studio.',
        },
        503,
      )
    }
    if (/^Gemini API \d{3}:/i.test(raw) || raw.includes('Resposta vazia da API do Gemini')) {
      return c.json(
        {
          message:
            'O assistente não obteve resposta válida da API Gemini. Confirme GEMINI_API_KEY no servidor, quotas em Google AI Studio e, se precisar, defina GEMINI_MODEL=gemini-2.0-flash. Os detalhes técnicos foram registados no log do servidor.',
        },
        502,
      )
    }
    if (raw && raw.length < 280) {
      return c.json({ message: raw }, 500)
    }
    return c.json(
      { message: 'Não foi possível processar sua pergunta agora. Tente novamente.' },
      500,
    )
  }
})

app.post('/api/ai/agenda-parse', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    if (!rateLimitTake(`ai-parse:${usuarioId}:${clientKeyFromHono(c)}`, 24, 60_000)) {
      return c.json({ message: 'Muitas interpretações seguidas. Aguarde um minuto.' }, 429)
    }

    const body = await c.req.json()
    const texto = String(body?.texto ?? '').trim()
    if (!texto) return c.json({ message: 'Envie o texto a interpretar.' }, 400)

    const rascunho = await parseAgendaFromTextWithAI(texto, new Date())
    return c.json({ ok: true, rascunho })
  } catch (error) {
    log.error('ai agenda-parse failed', error)
    const raw = String(error?.message || '')
    if (raw.includes('GEMINI_API_KEY') || /GEMINI_API_KEY não configurada/i.test(raw)) {
      return c.json(
        {
          message:
            'IA não configurada no servidor (GEMINI_API_KEY). O app tentará regras locais quando possível.',
        },
        503,
      )
    }
    if (raw && raw.length < 320) return c.json({ message: raw }, 400)
    return c.json({ message: 'Não foi possível interpretar o texto. Reformule com data e horário.' }, 400)
  }
})

app.post('/api/ai/transacao-parse', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const gate = await assertAcessoAppUsuario(usuarioId)
    if (gate) return c.json({ message: gate.message }, gate.status)

    if (!rateLimitTake(`ai-tx-parse:${usuarioId}:${clientKeyFromHono(c)}`, 24, 60_000)) {
      return c.json({ message: 'Muitas interpretações seguidas. Aguarde um minuto.' }, 429)
    }

    const body = await c.req.json()
    const texto = String(body?.texto ?? '').trim()
    if (!texto) return c.json({ message: 'Envie o texto a interpretar.' }, 400)

    const categorias = await getCategorias(usuarioId)
    const resultado = await parseWhatsAppMessageWithAI(texto, categorias)
    return c.json({ ok: true, resultado })
  } catch (error) {
    log.error('ai transacao-parse failed', error)
    const raw = String(error?.message || '')
    if (raw.includes('GEMINI_API_KEY') || /GEMINI_API_KEY não configurada/i.test(raw)) {
      return c.json(
        {
          message:
            'Chave de API do Gemini não configurada. Adicione GEMINI_API_KEY no .env do servidor.',
        },
        500,
      )
    }
    if (/quota|RESOURCE_EXHAUSTED|429/i.test(raw)) {
      return c.json(
        {
          message:
            'Limite de uso da API Gemini atingido. Aguarde alguns minutos ou verifique o plano em Google AI Studio.',
        },
        503,
      )
    }
    if (raw && raw.length < 280) return c.json({ message: raw }, 500)
    return c.json({ message: 'Não foi possível interpretar agora. Tente de novo.' }, 500)
  }
})

// WhatsApp Bot — chamado pelo n8n após receber mensagem da Evolution API
app.post('/api/whatsapp/bot/mensagem', async (c) => {
  const auth = assertBotSecret(c.req.header('Authorization'))
  if (!auth.ok) return c.json({ message: auth.message }, auth.status)

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ message: 'JSON inválido.' }, 400)
  }

  try {
    const result = await processWhatsappBotBody(body, { evolutionEnvFallback: true })
    return c.json(result.response, result.status)
  } catch (error) {
    log.error('[whatsapp-bot] processarMensagemBot failed', error)
    const raw = String(error?.message || '')
    if (/transcrev|Gemini|getBase64|baixar áudio|Áudio/i.test(raw)) {
      return c.json({ ok: false, reply: '🎙️ Não consegui transcrever o áudio. Tente novamente ou envie por texto.' }, 200)
    }
    return c.json({ ok: false, reply: '❌ Erro interno. Tente novamente.' }, 500)
  }
})

async function handleEvolutionWebhook(c) {
  const expected = process.env.WHATSAPP_WEBHOOK_TOKEN
  const token = c.req.param('token') || c.req.query('token')
  if (!expected || token !== expected) return c.json({ ok: false, message: 'Não autorizado.' }, 401)
  const eventParam = c.req.param('event') || ''

  let payload
  try {
    payload = await c.req.json()
  } catch {
    return c.json({ ok: false, message: 'JSON inválido.' }, 400)
  }

  const botBody = buildBotBodyFromEvolutionPayload(payload)
  if (!botBody) {
    log.info('[whatsapp-webhook] ignored', {
      event: eventParam || payload?.event || payload?.type || '',
      has_data: Boolean(payload?.data),
    })
    return c.json({ ok: true, ignored: true })
  }

  try {
    log.info('[whatsapp-webhook] received', {
      event: eventParam || payload?.event || payload?.type || '',
      instance: botBody.evolutionInstance || '',
      has_text: Boolean(botBody.message),
      has_audio: Boolean(botBody.audioBase64 || botBody.audioUrl || botBody.messageId),
    })
    const result = await processWhatsappBotBody(botBody, { evolutionEnvFallback: true })
    const reply = String(result.response?.reply || '').trim()
    let sent = Boolean(result.response?.whatsappOutboundSent)
    const textOut = reply
    if (!sent && textOut) {
      sent = await sendEvolutionText({
        instance: botBody.evolutionInstance || process.env.EVOLUTION_INSTANCE,
        number: botBody.phone,
        text: textOut,
      })
    }
    return c.json({ ok: true, sent, inputType: result.response?.inputType })
  } catch (error) {
    log.error('[whatsapp-webhook] failed', error)
    return c.json({ ok: false, message: 'Falha ao processar webhook WhatsApp.' }, 200)
  }
}

// Webhook direto da Evolution API. Útil quando o n8n não está ativo ou não envia mídia.
app.post('/api/whatsapp/webhook/:token', handleEvolutionWebhook)
app.post('/api/whatsapp/webhook/:token/:event', handleEvolutionWebhook)

app.notFound((c) => c.json({ message: 'Recurso não encontrado.' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  log.error('unhandled_route_error', {
    path: c.req.path,
    method: c.req.method,
    err: errorToText(err),
  })
  const mapped = mapSupabaseOrNetworkError(err)
  if (mapped) {
    return c.json({ message: mapped.message }, mapped.status)
  }
  return c.json(
    { message: 'Erro interno do servidor. Tente novamente em alguns instantes.' },
    500,
  )
})

export default app

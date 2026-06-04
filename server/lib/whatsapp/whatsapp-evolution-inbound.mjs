import { log } from '../logger.mjs'
import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { sendEvolutionText } from '../evolution-send.mjs'
// transcribeWhatsAppAudioWithGemini removido — áudio vai direto para parseWhatsAppAudioDirectWithAI via processarMensagemBot
import { processarMensagemBot } from '../domain/whatsapp-bot.mjs'
import { processarImportacaoDocumento } from '../domain/whatsapp-import.mjs'
import { atualizarWhatsappId, buscarUsuarioPorTelefone } from '../usuarios.mjs'
import { Alerts } from '../notify-telegram.mjs'

const SUPPORTED_DOC_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/pdf',
  'application/x-ofx',
  'application/ofx',
  'application/x-qfx',
])
const SUPPORTED_DOC_EXTS = new Set(['.xlsx', '.xls', '.csv', '.pdf', '.ofx', '.qfx'])

function parseJsonEnv(value) {
  try {
    return value ? JSON.parse(value) : {}
  } catch {
    return {}
  }
}

// SEC-A02: bloqueia SSRF — só HTTPS e sem IPs privados/link-local
function isSafeMediaUrl(rawUrl) {
  let u
  try { u = new URL(rawUrl) } catch { return false }
  if (u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase()
  if (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^::1$/.test(h) ||
    /^fc00:/i.test(h) ||
    /^fe80:/i.test(h)
  ) return false
  return true
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
    data?.message?.base64,
    data?.response?.base64
  )
}

/** Desembrulha ephemeral/viewOnce/edited (Baileys / Evolution antes do getBase64). */
function unwrapInnerMessage(msg) {
  if (!msg || typeof msg !== 'object') return {}
  const wrappers = [
    'ephemeralMessage',
    'documentWithCaptionMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'editedMessage',
  ]
  let cur = msg
  for (let depth = 0; depth < 16; depth++) {
    let next = null
    for (const w of wrappers) {
      const inner = cur[w]?.message
      if (inner && typeof inner === 'object') {
        next = inner
        break
      }
    }
    if (!next) break
    cur = next
  }
  return cur
}

/** Parte local do JID (@s.whatsapp.net, @lid, @c.us). */
function jidToPhoneDigits(remoteJid) {
  const local = String(remoteJid || '').split('@')[0] || ''
  return local.replace(/\D/g, '')
}

/**
 * Telefone só dígitos para bater com `usuarios.telefone`.
 * Com `...@lid`, o Baileys envia o número real em `remoteJidAlt` (PN).
 */
function resolvePhoneDigitsForBot(body) {
  const alt = firstString(body?.remoteJidAlt, body?.remoteJid_alt)
  const rj = firstString(body?.remoteJid)
  if (rj.endsWith('@lid') && alt) {
    return jidToPhoneDigits(alt)
  }
  const fromBody = String(body?.phone || '').replace(/\D/g, '')
  if (fromBody) return fromBody
  if (rj) return jidToPhoneDigits(rj)
  return ''
}

function isEvolutionWebMessageInfo(obj) {
  return Boolean(obj && typeof obj === 'object' && obj.key != null && 'message' in obj)
}

/**
 * Evolution / proxies enviam `data` como objeto único, array, ou `{ messages: [...] }`;
 * às vezes o POST vem em `body` (ex.: n8n).
 */
function collectEvolutionWebhookMessages(payload) {
  const out = []
  if (!payload || typeof payload !== 'object') return out

  const pushIfMsg = (obj) => {
    if (isEvolutionWebMessageInfo(obj)) out.push(obj)
  }

  const root = payload.body && typeof payload.body === 'object' ? payload.body : payload
  const raw = root.data !== undefined ? root.data : root

  if (Array.isArray(raw)) {
    raw.forEach(pushIfMsg)
    return out
  }

  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.messages)) {
      raw.messages.forEach(pushIfMsg)
      if (out.length) return out
    }
    pushIfMsg(raw)
    if (out.length) return out
    if (raw.data && typeof raw.data === 'object') {
      const inner = raw.data
      if (Array.isArray(inner.messages)) {
        inner.messages.forEach(pushIfMsg)
        if (out.length) return out
      }
      pushIfMsg(inner)
    }
  }

  return out
}

function resolveRemoteJidForMedia(body) {
  const data = body?.rawEvolutionData?.data
  const fromKey = firstString(body?.remoteJid, data?.key?.remoteJid)
  if (fromKey) return fromKey
  const p = String(body?.phone || '').replace(/\D/g, '')
  return p ? `${p}@s.whatsapp.net` : ''
}

/**
 * Evolution: se o POST não trouxer `message` completo, o servidor faz getMessage(key).
 * A key precisa de remoteJid/fromMe (não basta id). Preferimos enviar o WebMessageInfo inteiro do webhook.
 */
function buildGetBase64MessagePayload(body) {
  const messageId = firstString(
    body?.messageId,
    body?.audioMessageId,
    body?.rawEvolutionData?.data?.key?.id,
    body?.rawEvolutionData?.key?.id,
    body?.rawEvolutionData?.id
  )
  const data = body?.rawEvolutionData?.data
  const hasFull =
    data &&
    typeof data === 'object' &&
    data.key?.id &&
    data.message &&
    typeof data.message === 'object' &&
    Object.keys(data.message).length > 0

  if (hasFull) return data

  const remoteJid = resolveRemoteJidForMedia(body)
  const fromMe = Boolean(data?.key?.fromMe)
  const participant = data?.key?.participant ? String(data.key.participant) : ''
  if (!messageId || !remoteJid) return null

  return {
    key: {
      id: messageId,
      remoteJid,
      fromMe,
      ...(participant ? { participant } : {}),
    },
  }
}

async function audioBufferFromEvolutionMedia(body) {
  const baseUrl = firstString(process.env.EVOLUTION_API_URL, process.env.EVOLUTION_SERVER_URL)
  const instance = firstString(
    body?.evolutionInstance,
    body?.instance,
    body?.rawEvolutionData?.instance,
    body?.rawEvolutionData?.data?.instance,
    process.env.EVOLUTION_INSTANCE
  )
  const apiKey = firstString(body?.evolutionApiKey, process.env.EVOLUTION_API_KEY)

  const messagePayload = buildGetBase64MessagePayload(body)
  if (!messagePayload || !baseUrl || !instance || !apiKey) return null

  // Timeout para o download via Evolution (áudio e documento). Sem isto, um
  // documento grande pode pendurar o handler indefinidamente (bug 7.4).
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 60_000)
  let response
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: messagePayload,
        convertToMp4: false,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error('Evolution getBase64 timeout (60s)')
    }
    throw e
  } finally {
    clearTimeout(tid)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`Evolution getBase64 ${response.status}: ${String(data?.message || data?.error || JSON.stringify(data)).slice(0, 280)}`)
  }

  const b64 = extractBase64FromEvolutionResponse(data)
  return base64ToBuffer(b64)
}

async function audioBufferFromWhatsAppBody(body) {
  const direct = base64ToBuffer(body?.audioBase64 || body?.base64 || body?.mediaBase64)
  if (direct?.length) return direct

  let fromEvolution = null
  try {
    fromEvolution = await audioBufferFromEvolutionMedia(body)
  } catch (e) {
    log.warn('[whatsapp] getBase64FromMediaMessage falhou', { detail: String(e?.message || e).slice(0, 400) })
  }
  if (fromEvolution?.length) return fromEvolution

  const audioUrl = String(body?.audioUrl || body?.mediaUrl || body?.url || '').trim()
  if (!audioUrl) return null
  if (!isSafeMediaUrl(audioUrl)) {
    log.warn('[whatsapp] audioUrl bloqueada por SSRF guard', { url: audioUrl.slice(0, 120) })
    return null
  }

  const headers = {
    ...parseJsonEnv(process.env.WHATSAPP_MEDIA_FETCH_HEADERS),
    // body.mediaHeaders removido — injeção de headers pelo caller (SEC-A02)
  }
  const evolutionKey = body?.evolutionApiKey || process.env.EVOLUTION_API_KEY
  if (evolutionKey && !headers.apikey) headers.apikey = String(evolutionKey)

  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(audioUrl, { headers, signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Falha ao baixar áudio (${response.status}).`)
    }
    return Buffer.from(await response.arrayBuffer())
  } catch (e) {
    const detail = e?.name === 'AbortError' ? 'timeout (30s)' : String(e?.message || e).slice(0, 200)
    log.warn('[whatsapp] fetch audioUrl falhou', { url: audioUrl.slice(0, 120), detail })
    throw e
  } finally {
    clearTimeout(tid)
  }
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
    const textOk = await sendEvolutionText({
      instance,
      number: phone,
      remoteJid: body?.remoteJid,
      text: textToSend,
    })
    return Boolean(textOk)
  } catch (e) {
    log.error('[whatsapp] deliverWhatsappBotOutbound', e)
    return false
  }
}

export async function processWhatsappBotBody(body, options = {}) {
  const phone = resolvePhoneDigitsForBot(body)
  let message = String(body?.message || body?.text || body?.transcription || '').trim()
  let inputType = 'text'

  const wantsDocument = Boolean(body?.documentMessageId)

  const wantsAudio = Boolean(
    !message &&
      !wantsDocument &&
      (body?.audioBase64 ||
        body?.base64 ||
        body?.mediaBase64 ||
        body?.audioUrl ||
        body?.mediaUrl ||
        body?.url ||
        body?.messageId)
  )

  /* Documento (Excel/PDF/OFX): baixar e processar antes do claim */
  if (wantsDocument) {
    if (!phone) return { status: 400, response: { message: 'phone obrigatório.' } }

    const claimed = await claimWhatsAppInboundMessage(body, phone)
    if (!claimed) {
      return { status: 200, response: { ok: true, duplicate: true, reply: '' } }
    }

    let docBuffer = null
    try {
      docBuffer = await audioBufferFromEvolutionMedia(body)
    } catch (e) {
      log.warn('[whatsapp] falha ao baixar documento', { detail: String(e?.message || e).slice(0, 300) })
    }

    if (!docBuffer?.length) {
      return {
        status: 200,
        response: { ok: false, reply: '📄 Não consegui receber o arquivo. Tente enviar novamente.' },
      }
    }

    const result = await processarImportacaoDocumento(
      phone,
      docBuffer,
      body.documentMimeType || '',
      body.documentFileName || '',
    )

    return { status: 200, response: { ...result, inputType: 'document' } }
  }

  /* Áudio: baixar ANTES do claim — senão a Evolution retenta, o insert único bloqueia e o utilizador fica sem resposta.
   * Parse combinado (áudio → JSON direto) acontece dentro de processarMensagemBot para evitar 2 calls sequenciais. */
  let audioData = null
  if (wantsAudio) {
    const audioBuffer = await audioBufferFromWhatsAppBody(body)
    if (!audioBuffer?.length) {
      return {
        status: 400,
        response: { ok: false, reply: '🎙️ Não consegui receber o áudio. Tente enviar novamente.' },
      }
    }
    audioData = { audioBytes: audioBuffer, mimeHint: body?.mimeType || body?.mimetype || 'audio/ogg' }
    inputType = 'audio'
  }

  if (!phone || (!message && !audioData)) {
    return { status: 400, response: { message: 'phone e message ou áudio são obrigatórios.' } }
  }

  const claimed = await claimWhatsAppInboundMessage(body, phone)
  if (!claimed) {
    log.info('[whatsapp] duplicado — já processado (idempotência)', {
      messageId: firstString(
        body?.messageId,
        body?.rawEvolutionData?.data?.key?.id,
        body?.rawEvolutionData?.key?.id
      ),
    })
    return { status: 200, response: { ok: true, duplicate: true, reply: '' } }
  }

  const result = await processarMensagemBot(phone, message, audioData || {})
  if (body?.remoteJid?.endsWith('@lid') && result?.ok === true && phone) {
    try {
      const lidDigits = jidToPhoneDigits(body.remoteJid)
      const u = await buscarUsuarioPorTelefone(phone, { usarGemini: false })
      if (u?.id && lidDigits) await atualizarWhatsappId(u.id, lidDigits)
    } catch (e) {
      log.warn('[whatsapp] vincular whatsapp_id (LID)', { detail: String(e?.message || e).slice(0, 200) })
    }
  }

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

function buildBotBodyFromEvolutionSingle(data, payload) {
  if (!data || typeof data !== 'object') return null
  const key = data.key || {}
  const remoteJid = String(key.remoteJid || '')
  const remoteJidAlt = firstString(key.remoteJidAlt, key.remoteJid_alt)
  if (!remoteJid || remoteJid.endsWith('@g.us') || key.fromMe) return null

  const msgRaw = data.message || {}
  const msg = unwrapInnerMessage(msgRaw)
  const audio = msg.audioMessage || msg.pttMessage || {}
  const doc = msg.documentMessage || {}
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
  const hasAudio = Boolean(
    audio.url ||
      audio.mediaUrl ||
      audio.media_url ||
      data.mediaUrl ||
      data.audioUrl ||
      data.url ||
      audio.base64 ||
      data.base64 ||
      data.audioBase64 ||
      (messageId && (msg.audioMessage || msg.pttMessage))
  )

  const docMime = String(doc.mimetype || '').toLowerCase().split(';')[0].trim()
  const docFileName = String(doc.fileName || doc.filename || '').trim()
  const docExt = docFileName ? `.${docFileName.split('.').pop().toLowerCase()}` : ''
  const hasDocument = Boolean(
    messageId &&
      msg.documentMessage &&
      (SUPPORTED_DOC_MIMES.has(docMime) || SUPPORTED_DOC_EXTS.has(docExt))
  )

  if (!text && !hasAudio && !hasDocument) return null

  const phoneDigits =
    remoteJid.endsWith('@lid') && remoteJidAlt
      ? jidToPhoneDigits(remoteJidAlt)
      : jidToPhoneDigits(remoteJid)

  return {
    phone: phoneDigits,
    remoteJid,
    remoteJidAlt,
    message: text,
    audioUrl: firstString(audio.url, audio.mediaUrl, audio.media_url, data.mediaUrl, data.audioUrl, data.url),
    audioBase64: firstString(audio.base64, data.base64, data.audioBase64),
    mimeType: firstString(audio.mimetype, audio.mimeType, data.mimetype, data.mimeType, 'audio/ogg'),
    messageId,
    evolutionInstance: firstString(data.instance, payload?.instance, payload?.body?.instance),
    rawEvolutionData: { data },
    ...(hasDocument ? { documentMessageId: messageId, documentMimeType: docMime, documentFileName: docFileName } : {}),
  }
}

export function buildBotBodyFromEvolutionPayload(payload) {
  const parts = collectEvolutionWebhookMessages(payload)
  for (const data of parts) {
    const bot = buildBotBodyFromEvolutionSingle(data, payload)
    if (bot) return bot
  }
  return null
}

export async function handleEvolutionWebhook(c) {
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
        remoteJid: botBody.remoteJid,
        text: textOut,
      })
      if (!sent) {
        Alerts.whatsappSendFailed(botBody.phone).catch(() => {})
      }
    }
    if (result.response?.ok === false && !result.response?.duplicate) {
      const reply = String(result.response?.reply || '')
      const isExpected = reply.includes('não cadastrado') || reply.includes('Mensagem vazia')
      if (!isExpected) {
        Alerts.whatsappBotFailed(botBody.phone, reply).catch(() => {})
      }
    }
    return c.json({ ok: true, sent, inputType: result.response?.inputType })
  } catch (error) {
    log.error('[whatsapp-webhook] failed', error)
    Alerts.whatsappBotFailed(botBody?.phone, String(error?.message || error).slice(0, 300)).catch(() => {})
    return c.json({ ok: false, message: 'Falha ao processar webhook WhatsApp.' }, 200)
  }
}

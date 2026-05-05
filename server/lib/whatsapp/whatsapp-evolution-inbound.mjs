import { log } from '../logger.mjs'
import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { sendEvolutionText } from '../evolution-send.mjs'
import { transcribeWhatsAppAudioWithGemini } from '../ai.mjs'
import { processarMensagemBot } from '../domain/whatsapp-bot.mjs'

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

export async function processWhatsappBotBody(body, options = {}) {
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

export function buildBotBodyFromEvolutionPayload(payload) {
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
        text: textOut,
      })
    }
    return c.json({ ok: true, sent, inputType: result.response?.inputType })
  } catch (error) {
    log.error('[whatsapp-webhook] failed', error)
    return c.json({ ok: false, message: 'Falha ao processar webhook WhatsApp.' }, 200)
  }
}

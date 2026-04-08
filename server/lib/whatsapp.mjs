import { buscarUsuarioPorTelefone, registrarLogWhatsApp } from './usuarios.mjs'
import { getCategorias, inserirTransacao } from './transacoes.mjs'
import { parseWhatsAppMessageWithAI } from './ai.mjs'

/** Headers comuns em provedores (Telein, Evolution, Z-API, etc.) */
function collectTokenFromHeaders(getHeader) {
  const names = [
    'authorization',
    'x-api-key',
    'x-webhook-token',
    'x-token',
    'apikey',
    'token',
  ]
  for (const n of names) {
    const v = getHeader(n) || getHeader(n.replace(/^x-/, 'X-'))
    if (v) return v.replace(/^Bearer\s+/i, '').trim()
  }
  return ''
}

function mergePayloadRoots(body) {
  const roots = [body]
  if (body?.data && typeof body.data === 'object') roots.push(body.data)
  if (body?.body && typeof body.body === 'object') roots.push(body.body)
  if (body?.payload && typeof body.payload === 'object') roots.push(body.payload)
  return roots
}

/** req.url pode vir só como `/api/whatsapp/webhook?token=x` — new URL(iso) quebra sem base. */
function parseWebhookRequestUrl(req) {
  const raw = typeof req.url === 'string' ? req.url : req.raw?.url || ''
  if (!raw) return new URL('http://localhost/')
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw)
    return new URL(raw.startsWith('/') ? raw : `/${raw}`, 'http://localhost')
  } catch {
    return new URL('http://localhost/')
  }
}

/** Último recurso: qualquer remoteJid no JSON (Telein aninhado). */
function findAnyRemoteJidInPayload(obj, depth = 0) {
  if (!obj || depth > 16) return ''
  if (typeof obj === 'string') {
    return /@(s\.whatsapp\.net|c\.us|lid|g\.us)\b/.test(obj) ? obj : ''
  }
  if (typeof obj !== 'object') return ''
  if (typeof obj.remoteJid === 'string') return obj.remoteJid
  for (const v of Object.values(obj)) {
    const r = findAnyRemoteJidInPayload(v, depth + 1)
    if (r) return r
  }
  return ''
}

/**
 * Texto útil de um nó `message` Baileys.
 * Em muitos webhooks o campo `message` vem como string de sistema ("notify", "append") — não é conversa; ignorar evita exigir token à toa.
 */
function textFromBaileysMessageNode(msg) {
  if (msg == null) return ''
  if (typeof msg === 'string') {
    const t = msg.trim()
    if (!t) return ''
    if (t.startsWith('{')) {
      try {
        return textFromBaileysMessageNode(JSON.parse(t))
      } catch {
        return ''
      }
    }
    const low = t.toLowerCase()
    const noise = new Set([
      'notify',
      'append',
      'relay',
      'receipt',
      'ack',
      'read',
      'delivered',
      'sender',
      'receiver',
      'protocolmessage',
    ])
    if (noise.has(low)) return ''
    return msg
  }
  if (typeof msg !== 'object') return ''
  return (
    (typeof msg.conversation === 'string' && msg.conversation) ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    ''
  )
}

function getFromMeFromBody(body) {
  const candidates = [
    body?.body?.key?.fromMe,
    body?.key?.fromMe,
    body?.data?.key?.fromMe,
    body['body[key][fromMe]'],
  ]
  for (const v of candidates) {
    if (v === true || v === 'true') return true
    if (v === false || v === 'false') return false
  }
  return null
}

/**
 * Só exige token quando há texto de conversa inbound (usuário → bot).
 * Presença, sync de chave, JSON aninhado só com `body.key` etc. retornam false — evita 401 em ruído da Telein.
 */
function hasInboundChatTextToAuthenticate(body) {
  const roots = mergePayloadRoots(body)
  const globalFromMe = getFromMeFromBody(body)

  for (const root of roots) {
    const t = textFromBaileysMessageNode(root.message)
    if (t.trim()) {
      const fromHere = root.key?.fromMe
      if (fromHere === true) continue
      if (fromHere === false) return true
      if (globalFromMe === true) continue
      return true
    }
    if (Array.isArray(root.messages)) {
      for (const item of root.messages) {
        const t2 = textFromBaileysMessageNode(item?.message)
        if (!t2.trim()) continue
        if (item?.key?.fromMe === true) continue
        return true
      }
    }
  }

  const flatConv =
    body['body[message][conversation]'] || body['body[text]'] || body['message[conversation]'] || ''
  if (String(flatConv).trim()) {
    const fm = body['body[key][fromMe]']
    if (fm === true || fm === 'true') return false
    return true
  }

  return false
}

/** Indica texto de conversa em payloads flat (Telein) ou aninhados. */
function hasChatContentHints(keys) {
  return keys.some((k) => {
    const low = k.toLowerCase()
    return (
      low.includes('conversation') ||
      low.includes('body[message]') ||
      low.includes('[message][conversation]') ||
      low.includes('[message][extendedtextmessage]') ||
      low.includes('extendedtextmessage') ||
      (low.includes('message') && (low.includes('text') || low.includes('conversation')))
    )
  })
}

/** Presença online/offline — não é mensagem; Baileys manda sem token na URL. */
function hasPresenceHints(keys) {
  return keys.some((k) => {
    const low = k.toLowerCase()
    return low.includes('presences') || low.includes('presence]') || low.includes('lastknownpresence')
  })
}

/** Só metadados de chave (ack, sync, id) — típico `body[key][remoteJid]` sem `body[message]`. Telein pode acrescentar event/instance. */
function looksLikeBaileysKeyMetadataOnly(keys) {
  if (hasChatContentHints(keys) || hasPresenceHints(keys)) return false
  if (keys.length === 0) return false
  const extraMeta = new Set([
    'event',
    'instance',
    'session',
    'id',
    'sender',
    'receiver',
    'trace',
    'traceid',
    'timestamp',
    'ts',
  ])
  return keys.every((k) => {
    if (k === 'key' || k === 'type') return true
    if (extraMeta.has(k.toLowerCase())) return true
    if (k.startsWith('body[key]') || k === 'body[key]') return true
    return false
  })
}

/** Objeto aninhado com mapa de presenças (ex.: body.presences["...@lid"]). */
function nestedHasPresencesMap(obj, depth = 0) {
  if (!obj || depth > 14 || typeof obj !== 'object') return false
  if (obj.presences && typeof obj.presences === 'object') return true
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase() === 'presences' && v && typeof v === 'object') return true
    if (nestedHasPresencesMap(v, depth + 1)) return true
  }
  return false
}

/**
 * Eventos que a Chipmassa/Telein (Baileys) enviam sem token no corpo — conexão, QR, presença, sync de chaves.
 * Responder 200 sem exigir autenticação evita poluir logs com "Acesso não autorizado".
 */
function isIgnorableProviderEvent(body) {
  const ev = String(body.event || body.Event || '').toLowerCase()
  if (
    ev.includes('connection') ||
    ev.includes('qrcode') ||
    ev.includes('qr.') ||
    ev === 'logout' ||
    ev.includes('presence')
  ) {
    return true
  }

  const typeStr = String(body.type || '').toLowerCase()
  if (typeStr === 'connection' || typeStr === 'chats.set' || typeStr === 'contacts.set') {
    return true
  }

  const keys = Object.keys(body)

  if (hasPresenceHints(keys) && !hasChatContentHints(keys)) {
    return true
  }

  if (nestedHasPresencesMap(body) && !hasChatContentHints(keys)) {
    return true
  }

  if (looksLikeBaileysKeyMetadataOnly(keys)) {
    return true
  }

  const hasFlatConnection = keys.some((k) => k.includes('[connection]') || k === 'connection' || k.endsWith('connection'))
  const hasMessageHint = keys.some(
    (k) =>
      k.toLowerCase().includes('message') ||
      k.toLowerCase().includes('conversation') ||
      k.toLowerCase().includes('text') ||
      k.toLowerCase().includes('body[message]')
  )

  if (hasFlatConnection && !hasMessageHint) {
    return true
  }

  for (const root of mergePayloadRoots(body)) {
    if (root.connection != null && !root.message && !root.messages) {
      const nestedMsg = root.body?.message
      if (!nestedMsg) return true
    }
  }

  return false
}

function firstRemoteJidFromMessagesArray(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return ''
  const m = messages[0]
  return m?.key?.remoteJid || m?.messageStubParameters?.[0] || ''
}

/**
 * Extrai telefone (só dígitos) e texto da mensagem para vários formatos (flat Telein, Evolution, Baileys).
 */
function extractRemetenteEMensagem(body) {
  let remetenteRaw = ''
  let mensagemRaw = ''

  const roots = mergePayloadRoots(body)

  for (const root of roots) {
    if (!remetenteRaw) {
      remetenteRaw =
        root.phone ||
        root.from ||
        root.sender ||
        root.participant ||
        root.key?.remoteJid ||
        firstRemoteJidFromMessagesArray(root.messages)
    }
    if (!mensagemRaw) {
      const direct =
        root.text ||
        root.content ||
        root.body?.conversation ||
        textFromBaileysMessageNode(root.message)
      mensagemRaw = direct || ''
    }
  }

  // Chaves "achatadas" (form-urlencoded / alguns gateways)
  if (!mensagemRaw) {
    mensagemRaw =
      body['body[message][conversation]'] ||
      body['body[text]'] ||
      body['message[conversation]'] ||
      ''
  }
  if (!remetenteRaw) {
    remetenteRaw = body['body[key][remoteJid]'] || body['key[remoteJid]'] || ''
  }

  if (typeof remetenteRaw === 'object' && remetenteRaw?.remoteJid) {
    remetenteRaw = remetenteRaw.remoteJid
  }
  if (typeof body.key === 'object' && body.key?.remoteJid && !remetenteRaw) {
    remetenteRaw = body.key.remoteJid
  }

  // Evolution: mensagem em data.messages[]
  if (!remetenteRaw && body.data?.messages?.[0]?.key?.remoteJid) {
    remetenteRaw = body.data.messages[0].key.remoteJid
  }
  if (!mensagemRaw && body.data?.messages?.[0]?.message) {
    const msg = body.data.messages[0].message
    mensagemRaw = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || ''
  }

  if (!remetenteRaw) {
    remetenteRaw = findAnyRemoteJidInPayload(body)
  }

  const msgFinal =
    typeof mensagemRaw === 'string' ? mensagemRaw : textFromBaileysMessageNode(mensagemRaw)
  return { remetenteRaw, mensagemRaw: msgFinal || '' }
}

function tokenMatches(finalToken, expected) {
  if (!expected) return false
  const t = String(finalToken || '').trim()
  const e = String(expected).trim()
  if (!t) return false
  return t === e
}

export async function handleWhatsAppWebhook(req, options = {}) {
  let pathToken = String(options.pathToken || '').trim()
  try {
    pathToken = decodeURIComponent(pathToken)
  } catch {
    /* mantém bruto */
  }

  let numeroRemetente = 'Desconhecido'
  let mensagemRaw = 'Sem conteúdo'
  let usuarioTarget = null

  try {
    const getHeader = (name) => {
      try {
        return req.header(name) || ''
      } catch {
        return req.headers && req.headers.get ? req.headers.get(name) : req.headers ? req.headers[name] : ''
      }
    }

    const rawAuth = collectTokenFromHeaders(getHeader)
    const EXPECTED_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || 'ece58f64012d51028d28a04264d07131'

    console.log('[WhatsApp Webhook] Chamada recebida.')

    let body = {}
    let rawText = ''
    const contentType = getHeader('content-type') || ''

    try {
      rawText = await (typeof req.text === 'function' ? req.text() : req.raw ? await req.raw.text() : '')
      if (rawText && rawText.trim() !== '') {
        if (contentType.includes('application/json')) {
          try {
            body = JSON.parse(rawText)
          } catch {
            body = Object.fromEntries(new URLSearchParams(rawText))
          }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          body = Object.fromEntries(new URLSearchParams(rawText))
        } else {
          try {
            body = JSON.parse(rawText)
          } catch {
            body = Object.fromEntries(new URLSearchParams(rawText))
          }
        }
      }
    } catch (e) {
      console.error('[WhatsApp Webhook] Erro crítico ao ler body:', e.message)
      await registrarLogWhatsApp('?', 'Requisição Ilegível', 'ERRO', `CT: ${contentType} | Erro: ${e.message} | Raw: ${rawText.substring(0, 100)}`)
      return { status: 400, json: { error: 'Invalid Body' } }
    }

    // Heartbeat / conexão / QR explícitos
    if (isIgnorableProviderEvent(body)) {
      console.log('[WhatsApp Webhook] Evento de sistema/conexão ignorado (OK).')
      return { status: 200, json: { ok: true, ignored: 'system_or_connection_event' } }
    }

    // Telein manda JSON aninhado (só key/type/body) — não é "mensagem" com texto; não exige token nem grava ERRO
    if (!hasInboundChatTextToAuthenticate(body)) {
      console.log('[WhatsApp Webhook] Sem texto de conversa inbound — ignorado (sync/presença/ack).')
      return { status: 200, json: { ok: true, ignored: 'no_inbound_chat_to_process' } }
    }

    const url = parseWebhookRequestUrl(req)
    const tokenFromQuery =
      url.searchParams.get('token') ||
      url.searchParams.get('api_token') ||
      url.searchParams.get('apiKey') ||
      url.searchParams.get('secret') ||
      ''

    let tokenFromBody =
      body.token || body.api_token || body.apiKey || body.auth || body.Token || body.webhookSecret || ''

    if (!tokenFromBody) {
      for (const k in body) {
        if (String(body[k]) === EXPECTED_TOKEN) {
          tokenFromBody = body[k]
          break
        }
      }
    }

    const finalToken = (pathToken || rawAuth || tokenFromQuery || tokenFromBody).replace(/^Bearer\s+/i, '').trim()

    if (!tokenMatches(finalToken, EXPECTED_TOKEN)) {
      const preview = extractRemetenteEMensagem(body)
      let telForLog = '?'
      if (preview.remetenteRaw) {
        const digits = String(preview.remetenteRaw).replace(/\D/g, '')
        if (digits) telForLog = digits
      }
      const msgPrev = (preview.mensagemRaw || '').slice(0, 200)
      console.warn('[WhatsApp Webhook] Token inválido ou ausente para payload com possível mensagem.')
      const bodyKeys = Object.keys(body).join(', ')
      const maskedToken = finalToken ? `${finalToken.substring(0, 5)}...` : 'ausente'
      await registrarLogWhatsApp(
        telForLog,
        'Acesso não autorizado',
        'ERRO',
        `Token detectado: ${maskedToken} | Texto: ${msgPrev || '(não extraído)'} | Campos: [${bodyKeys.slice(0, 160)}]`
      )
      return { status: 401, json: { error: 'Unauthorized' } }
    }

    const extracted = extractRemetenteEMensagem(body)
    let remetenteRaw = extracted.remetenteRaw
    mensagemRaw = extracted.mensagemRaw || ''

    numeroRemetente = String(remetenteRaw || '').replace(/\D/g, '')

    const tokenFromBodyBool = !!tokenFromBody
    const debugInfo = `Tokens: Query=${!!tokenFromQuery}, Body=${tokenFromBodyBool} | Msg: ${mensagemRaw.substring(0, 20)}`

    // Payload autenticado mas sem dados de conversa (ex.: ack, reaction)
    if (!numeroRemetente && !mensagemRaw.trim()) {
      console.log('[WhatsApp Webhook] Autenticado; sem remetente/mensagem — ignorando.')
      return { status: 200, json: { ok: true, ignored: 'no_chat_payload' } }
    }

    if (!numeroRemetente) {
      await registrarLogWhatsApp('?', mensagemRaw || '(sem texto)', 'IGNORADO', `Não foi possível identificar o telefone do remetente. ${debugInfo}`)
      return { status: 200, json: { ok: true, warning: 'Remetente não identificado no payload.' } }
    }

    if (!mensagemRaw.trim()) {
      await registrarLogWhatsApp(numeroRemetente, '(sem texto)', 'IGNORADO', `Mensagem vazia ou formato não suportado. ${debugInfo}`)
      return { status: 200, json: { ok: true, warning: 'Sem texto de mensagem.' } }
    }

    if (numeroRemetente === '554799895014') {
      return { status: 200, json: { ok: true, message: 'Ignorando o próprio número.' } }
    }

    console.log(`[WhatsApp Webhook] Mensagem recebida de: ${numeroRemetente} -> "${mensagemRaw}"`)

    usuarioTarget = await buscarUsuarioPorTelefone(numeroRemetente)
    if (!usuarioTarget) {
      console.warn(`[WhatsApp Webhook] Telefone ${numeroRemetente} não possui usuário vinculado.`)
      await registrarLogWhatsApp(numeroRemetente, mensagemRaw || '(sem texto)', 'IGNORADO', `Usuário não vinculado. ${debugInfo}`)
      return { status: 200, json: { ok: true, warning: 'Usuário não registrado com esse telefone.' } }
    }

    const categorias = await getCategorias(usuarioTarget.id)
    if (!categorias || categorias.length === 0) {
      throw new Error('Usuário sem categorias no sistema para mapear a despesa.')
    }

    console.log(`[WhatsApp Webhook] Passando p/ AI... usuário: ${usuarioTarget.email}`)
    const extractedData = await parseWhatsAppMessageWithAI(mensagemRaw, categorias)

    if (!extractedData.tipo || !extractedData.valor) {
      throw new Error('A IA não conseguiu interpretar um valor ou tipo de transação na frase enviada.')
    }

    const payLoadTransacao = {
      usuario_id: usuarioTarget.id,
      tipo: extractedData.tipo,
      valor: extractedData.valor,
      descricao: extractedData.descricao || 'Adicionado via WhatsApp',
      data_transacao: new Date().toISOString(),
      status: 'EFETIVADA',
    }

    if (extractedData.categoria_id) payLoadTransacao.categoria_id = extractedData.categoria_id
    if (extractedData.subcategoria_id) payLoadTransacao.subcategoria_id = extractedData.subcategoria_id

    const transacaoSalva = await inserirTransacao(payLoadTransacao)

    console.log(`[WhatsApp Webhook] Transação salva com sucesso: ${transacaoSalva.id}`)

    await registrarLogWhatsApp(numeroRemetente, mensagemRaw, 'SUCESSO', `Transação adicionada: ${extractedData.tipo} | R$${extractedData.valor}`, usuarioTarget.id)

    return {
      status: 200,
      json: {
        ok: true,
        message: 'Lançamento efetuado via IA com sucesso',
        transacao: transacaoSalva,
      },
    }
  } catch (error) {
    console.error('[WhatsApp Webhook] ERROR:', error)

    await registrarLogWhatsApp(numeroRemetente, mensagemRaw, 'ERRO', error.message || 'Erro inesperado', usuarioTarget?.id)

    return { status: 200, json: { ok: false, error: error.message || 'Erro interno.' } }
  }
}

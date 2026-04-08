import { buscarUsuarioPorTelefone, registrarLogWhatsApp } from './usuarios.mjs'
import { getCategorias, inserirTransacao } from './transacoes.mjs'
import { parseWhatsAppMessageWithAI } from './ai.mjs'

export async function handleWhatsAppWebhook(req) {
  let numeroRemetente = 'Desconhecido'
  let mensagemRaw = 'Sem conteúdo'
  let usuarioTarget = null

  try {
    // 0. Log preventivo para saber se o webhook foi atingido (Hono c.req.header or Request.headers.get)
    const getHeader = (name) => {
      try {
        return req.header(name) || ''
      } catch {
        // Fallback for non-Hono requests if any
        return (req.headers && req.headers.get) ? req.headers.get(name) : (req.headers ? req.headers[name] : '')
      }
    }

    const rawAuth = getHeader('authorization') || getHeader('x-api-key') || ''
    const EXPECTED_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || 'ece58f64012d51028d28a04264d07131'

    console.log(`[WhatsApp Webhook] Chamada recebida. Verificando Token...`)

    // 1. Extrair Body de forma ultra-robusta
    let body = {}
    let rawText = ''
    const contentType = getHeader('content-type') || ''
    
    try {
      // Hono c.req.text() fallback to Request.text()
      rawText = await (typeof req.text === 'function' ? req.text() : (req.raw ? await req.raw.text() : ''))
      
      if (rawText && rawText.trim() !== '') {
        if (contentType.includes('application/json')) {
          try {
            body = JSON.parse(rawText)
          } catch (e) {
            // Fallback: se o header diz que é JSON mas falhou o parse, tenta ver se é urlencoded
            body = Object.fromEntries(new URLSearchParams(rawText))
          }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          body = Object.fromEntries(new URLSearchParams(rawText))
        } else {
          // Última tentativa: tenta JSON, se falhar tenta urlencoded
          try {
            body = JSON.parse(rawText)
          } catch {
            body = Object.fromEntries(new URLSearchParams(rawText))
          }
        }
      } else {
        // Se texto vazio e for multipart, o text() pode não ter pego. Tenta parseBody() se o stream permitir
        // Mas como já chamamos text(), o stream foi consumido. 
        // Em Vercel/Hono, é melhor confiar no text() ou json()
      }
    } catch (e) {
      console.error('[WhatsApp Webhook] Erro crítico ao ler body:', e.message)
      await registrarLogWhatsApp('?', 'Requisição Ilegível', 'ERRO', `CT: ${contentType} | Erro: ${e.message} | Raw: ${rawText.substring(0, 100)}`)
      return { status: 400, json: { error: 'Invalid Body' } }
    }

    // 2. Validar Token (Headers, Body ou Query)
    const url = new URL(typeof req.url === 'string' ? req.url : (req.raw ? req.raw.url : 'http://localhost'))
    const tokenFromQuery = url.searchParams.get('token') || url.searchParams.get('api_token') || url.searchParams.get('key') || ''
    
    const tokenFromBody = body.token || body.api_token || body.apikey || body.Token || body.key || ''
    const finalToken = (rawAuth || tokenFromQuery || tokenFromBody).replace('Bearer ', '').trim()

    if (!finalToken.includes(EXPECTED_TOKEN)) {
      console.warn('[WhatsApp Webhook] Token Inválido')
      const bodyKeys = Object.keys(body).join(', ') || 'nenhum campo no body'
      const maskedToken = finalToken ? `${finalToken.substring(0, 4)}...` : 'ausente'
      await registrarLogWhatsApp('?', 'Acesso não autorizado', 'ERRO', `Token: ${maskedToken} | Campos recebidos: [${bodyKeys}]`)
      return { status: 401, json: { error: 'Unauthorized', debug: bodyKeys } }
    }

    // Melhora a extração de dados para campos "achatados" (ex: body[message][conversation])
    const getDeepValue = (obj, path) => {
        // Tenta achar a chave exata primeiro
        if (obj[path]) return obj[path]
        // Se não achar, tenta achar em chaves que contêm o caminho (ex: se path é 'conversation', procura em 'body[message][conversation]')
        for (const key in obj) {
            if (key.includes(`[${path}]`) || key.endsWith(path)) return obj[key]
        }
        return ''
    }

    // 2. Extrair dados da mensagem conforme a API Evolution/Z-API/Telein (Flat & Deep)
    let remetenteRaw = body.phone || body.from || body.sender || getDeepValue(body, 'remoteJid') || getDeepValue(body, 'participant') || ''
    mensagemRaw = body.text || body.message || body.content || getDeepValue(body, 'conversation') || getDeepValue(body, 'text') || ''

    // Se ainda estiver vazio, tenta uma busca exaustiva por qualquer campo que pareça mensagem
    if (!mensagemRaw) {
        mensagemRaw = body['body[message][conversation]'] || body['body[text]'] || ''
    }
    if (!remetenteRaw) {
        remetenteRaw = body['body[key][remoteJid]'] || body['key'] || ''
    }

    if (typeof remetenteRaw === 'object' && remetenteRaw.remoteJid) remetenteRaw = remetenteRaw.remoteJid
    
    numeroRemetente = String(remetenteRaw).replace(/\D/g, '')

    // Log de diagnóstico atualizado
    const debugInfo = `Tokens: Query=${!!tokenFromQuery}, Body=${!!tokenFromBody} | Msg: ${mensagemRaw.substring(0, 20)}`

    if (numeroRemetente === '554799895014') {
        return { status: 200, json: { ok: true, message: 'Ignorando o próprio número.' } }
    }

    console.log(`[WhatsApp Webhook] Mensagem recebida de: ${numeroRemetente} -> "${mensagemRaw}"`)

    // ... Resto do processamento ...
    usuarioTarget = await buscarUsuarioPorTelefone(numeroRemetente)
    if (!usuarioTarget) {
      console.warn(`[WhatsApp Webhook] Telefone ${numeroRemetente} não possui usuário vinculado.`)
      await registrarLogWhatsApp(numeroRemetente, mensagemRaw || '(sem texto)', 'IGNORADO', `Usuário não vinculado. ${debugInfo}`)
      return { status: 200, json: { ok: true, warning: 'Usuário não registrado com esse telefone.' } }
    }

    // 4. Se Usuário achado, Pegar Categorias do Usuario
    const categorias = await getCategorias(usuarioTarget.id)
    if (!categorias || categorias.length === 0) {
        throw new Error('Usuário sem categorias no sistema para mapear a despesa.')
    }

    // 5. Passar para a Inteligência Artificial decodificar e classificar
    console.log(`[WhatsApp Webhook] Passando p/ AI... usuário: ${usuarioTarget.email}`)
    const extractedData = await parseWhatsAppMessageWithAI(mensagemRaw, categorias)

    if (!extractedData.tipo || !extractedData.valor) {
        throw new Error('A IA não conseguiu interpretar um valor ou tipo de transação na frase enviada.')
    }

    // 6. Inserir Transacao no Supabase
    const payLoadTransacao = {
      usuario_id: usuarioTarget.id,
      tipo: extractedData.tipo,
      valor: extractedData.valor,
      descricao: extractedData.descricao || 'Adicionado via WhatsApp',
      data_transacao: new Date().toISOString(),
      status: 'EFETIVADA'
    }

    if (extractedData.categoria_id) payLoadTransacao.categoria_id = extractedData.categoria_id
    if (extractedData.subcategoria_id) payLoadTransacao.subcategoria_id = extractedData.subcategoria_id

    const transacaoSalva = await inserirTransacao(payLoadTransacao)

    console.log(`[WhatsApp Webhook] Transação salva com sucesso: ${transacaoSalva.id}`)

    // 7. Salvar Log com Sucesso
    await registrarLogWhatsApp(numeroRemetente, mensagemRaw, 'SUCESSO', `Transação adicionada: ${extractedData.tipo} | R$${extractedData.valor}`, usuarioTarget.id)

    return { 
      status: 200, 
      json: { 
        ok: true, 
        message: 'Lançamento efetuado via IA com sucesso',
        transacao: transacaoSalva
      } 
    }
  } catch (error) {
    console.error('[WhatsApp Webhook] ERROR:', error)
    
    // Registrar erro no banco se possível
    await registrarLogWhatsApp(numeroRemetente, mensagemRaw, 'ERRO', error.message || 'Erro inesperado', usuarioTarget?.id)
    
    return { status: 200, json: { ok: false, error: error.message || 'Erro interno.' } }
  }
}

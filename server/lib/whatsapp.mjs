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
      if (typeof req.header === 'function') return req.header(name)
      if (req.headers && typeof req.headers.get === 'function') return req.headers.get(name)
      return null
    }

    const rawAuth = getHeader('authorization') || getHeader('x-api-key') || ''
    const apiToken = rawAuth.replace('Bearer ', '').trim()
    const EXPECTED_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || 'ece58f64012d51028d28a04264d07131'

    console.log(`[WhatsApp Webhook] Chamada recebida. Verificando Token...`)

    // 1. Extrair Body (Hono c.req.json or Request.json)
    let body
    try {
      body = typeof req.json === 'function' ? await req.json() : await req.parseBody()
    } catch (e) {
      console.error('[WhatsApp Webhook] Erro ao ler body JSON:', e)
      return { status: 400, json: { error: 'Invalid JSON Body' } }
    }

    // Tentar extrair remetente básico para log preliminar se token falhar
    let preRemetente = 'Desconhecido'
    if (body.phone) preRemetente = String(body.phone)
    else if (body.data?.remoteJid) preRemetente = body.data.remoteJid.split('@')[0]
    else if (body.messages?.[0]?.from) preRemetente = body.messages[0].from
    
    preRemetente = preRemetente.replace(/\D/g, '')

    // VALIDAR TOKEN
    if (apiToken !== EXPECTED_TOKEN) {
      console.warn(`[WhatsApp Webhook] Token Inválido! Recebido: "${apiToken}"`)
      await registrarLogWhatsApp(preRemetente || '?', mensagemRaw, 'ERRO_TOKEN', `Tentativa de acesso com token inválido.`)
      return { status: 401, json: { error: 'Token Inválido ou Ausente' } }
    }

    // 2. Extrair dados da mensagem conforme a API Evolution/Z-API
    let remetenteRaw = ''

    if (body.data && body.data.remoteJid) {
      remetenteRaw = body.data.remoteJid.split('@')[0]
      mensagemRaw = body.data.message?.conversation || body.data.message?.extendedTextMessage?.text || ''
    } else if (body.phone && body.text) {
        remetenteRaw = String(body.phone)
        mensagemRaw = String(body.text)
    } else if (body.messages && body.messages[0]) {
      remetenteRaw = body.messages[0].from
      mensagemRaw = body.messages[0].text?.body || ''
    } else {
        remetenteRaw = String(body.from || body.sender || '')
        mensagemRaw = String(body.text || body.message || '')
    }

    if (!remetenteRaw || !mensagemRaw) {
      console.log(`[WhatsApp Webhook] Payload vazio ou incompleto.`)
      return { status: 200, json: { ok: true, message: 'Nenhuma mensagem recebida ou remetente ignorado.' } }
    }

    numeroRemetente = remetenteRaw.replace(/\D/g, '')

    if (numeroRemetente === '554799895014') {
        return { status: 200, json: { ok: true, message: 'Ignorando o próprio número.' } }
    }

    console.log(`[WhatsApp Webhook] Mensagem recebida de: ${numeroRemetente} -> "${mensagemRaw}"`)

    // 3. Buscar no Banco pelo Usuario com aquele telefone
    usuarioTarget = await buscarUsuarioPorTelefone(numeroRemetente)
    if (!usuarioTarget) {
      console.warn(`[WhatsApp Webhook] Telefone ${numeroRemetente} não possui usuário vinculado.`)
      await registrarLogWhatsApp(numeroRemetente, mensagemRaw, 'IGNORADO', 'Usuário não registrado com esse telefone.')
      return { status: 200, json: { ok: true, warning: 'Usuário não registrado com esse telefone. Mensagem ignorada.' } }
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

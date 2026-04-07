import { buscarUsuarioPorTelefone } from './usuarios.mjs'
import { getCategorias, inserirTransacao } from './transacoes.mjs'
import { parseWhatsAppMessageWithAI } from './ai.mjs'

export async function handleWhatsAppWebhook(req) {
  try {
    // 1. Validar o Token Api de Segurança
    const rawAuth = req.headers.get('authorization') || req.headers.get('x-api-key') || ''
    const apiToken = rawAuth.replace('Bearer ', '').trim()

    // O token configurado da provedora
    const EXPECTED_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || 'ece58f64012d51028d28a04264d07131'

    if (apiToken !== EXPECTED_TOKEN) {
      return { status: 401, json: { error: 'Token Inválido ou Ausente' } }
    }

    // 2. Extrair dados da mensagem conforme a API Evolution/Z-API
    const body = await req.json()
    
    // Tratativa para extrair Remetente e Mensagem (formato padrão provedoras independentes)
    // Variamos em .data (Evolution/Z-Api) e .messages (Oficial)
    let remetenteRaw = ''
    let mensagemRaw = ''

    if (body.data && body.data.remoteJid) {
      // Formato Baileys/Evolution API
      remetenteRaw = body.data.remoteJid.split('@')[0]
      mensagemRaw = body.data.message?.conversation || body.data.message?.extendedTextMessage?.text || ''
    } else if (body.phone && body.text) {
        // Formato Simplificado ou Chatwoot custom
        remetenteRaw = String(body.phone)
        mensagemRaw = String(body.text)
    } else if (body.messages && body.messages[0]) {
      // Formato Oficial (Meta)
      remetenteRaw = body.messages[0].from
      mensagemRaw = body.messages[0].text?.body || ''
    } else {
        // Tentativa de fallback
        remetenteRaw = String(body.from || body.sender || '')
        mensagemRaw = String(body.text || body.message || '')
    }

    // Não processa mensagens do próprio bot caso cheguem e não tenha texto
    if (!remetenteRaw || !mensagemRaw) {
      return { status: 200, json: { ok: true, message: 'Nenhuma mensagem recebida ou remetente ignorado.' } }
    }

    // Limpar numero do remetente (apenas dígitos)
    const numeroRemetente = remetenteRaw.replace(/\D/g, '')

    // Ignora processamento retroativo pro próprio número do bot
    if (numeroRemetente === '554799895014') {
        return { status: 200, json: { ok: true, message: 'Ignorando o próprio número.' } }
    }

    console.log(`[WhatsApp Webhook] Mensagem recebida de: ${numeroRemetente} -> "${mensagemRaw}"`)

    // 3. Buscar no Banco pelo Usuario com aquele telefone
    const usuario = await buscarUsuarioPorTelefone(numeroRemetente)
    if (!usuario) {
      console.warn(`[WhatsApp Webhook] Usuário não encontrado para telefone: ${numeroRemetente}`)
      return { status: 200, json: { ok: true, warning: 'Usuário não registrado com esse telefone. Mensagem ignorada.' } }
    }

    // 4. Se Usuário achado, Pegar Categorias do Usuario
    const categorias = await getCategorias(usuario.id)
    if (!categorias || categorias.length === 0) {
        throw new Error('Você não possui categorias para lançar essa despesa.')
    }

    // 5. Passar para a Inteligência Artificial decodificar e classificar
    console.log(`[WhatsApp Webhook] Passando p/ AI... usuário: ${usuario.email}`)
    const extractedData = await parseWhatsAppMessageWithAI(mensagemRaw, categorias)

    if (!extractedData.tipo || !extractedData.valor) {
        throw new Error('A IA não localizou um valor ou tipo de transação na mensagem.')
    }

    // 6. Inserir Transacao no Supabase
    const payLoadTransacao = {
      usuario_id: usuario.id,
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
    // No webhook, muitas vezes returning 500 faz o provider re-enviar.
    // Retornamos 200 porém com json denotando falha para evitar retry loops infinitos de erros de usuários.
    return { status: 200, json: { ok: false, error: error.message || 'Erro interno.' } }
  }
}

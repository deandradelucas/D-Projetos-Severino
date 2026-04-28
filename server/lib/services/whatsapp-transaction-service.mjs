import { log } from '../logger.mjs'
import { getCategorias } from '../transacoes.mjs'
import { parseWhatsAppMessageWithAI, askHorizon } from '../ai.mjs'
import { TransactionService } from './transaction-service.mjs'

/**
 * WhatsAppTransactionService — Orquestra o pipeline completo:
 * mensagem/áudio → IA → transação → log.
 *
 * Esta camada de serviço isola a lógica de negócio do código de parsing
 * de webhook em whatsapp.mjs, tornando-a reutilizável e testável.
 */
export const WhatsAppTransactionService = {
  /**
   * Processa uma mensagem de texto do WhatsApp e persiste como transação.
   *
   * @param {string} usuarioId
   * @param {string} textoUsuario  Mensagem (pode vir de texto direto ou de ASR de áudio)
   * @returns {{ transaction: object, detalheSucesso: string, catNome: string, subNome: string }}
   */
  async processMessage(usuarioId, textoUsuario) {
    if (!usuarioId) throw new Error('ID do usuário é obrigatório.')
    if (!textoUsuario?.trim()) throw new Error('Mensagem vazia.')

    // 1. Buscar categorias do usuário (necessário para mapeamento de transações)
    const categorias = await getCategorias(usuarioId) || []

    log.info(`[WhatsAppTransactionService] Enviando para IA: "${textoUsuario.slice(0, 100)}"`)

    // 2. Extração via IA (categorias podem estar vazias — CHAT não precisa delas)
    const extractedData = categorias.length > 0
      ? await parseWhatsAppMessageWithAI(textoUsuario, categorias)
      : { tipo: 'CHAT', resposta: null }

    if (extractedData.tipo === 'CHAT') {
      let respostaChat = extractedData.resposta || 'Interação interpretada.'
      try {
        respostaChat = await askHorizon(textoUsuario, usuarioId)
      } catch (e) {
        log.warn('[WhatsAppTransactionService] askHorizon falhou, usando resposta genérica:', e?.message)
      }
      return {
        transaction: { id: 'chat-' + Date.now() },
        detalheSucesso: respostaChat,
        isChat: true,
      }
    }

    if (!extractedData.tipo || !extractedData.valor) {
      throw new Error('A IA não conseguiu interpretar um valor ou tipo de transação na frase enviada.')
    }

    if (categorias.length === 0) {
      throw new Error('Usuário sem categorias no sistema para mapear a despesa.')
    }

    // 3. Criação da transação via TransactionService (centralizado)
    const payload = {
      tipo: extractedData.tipo,
      valor: extractedData.valor,
      descricao: extractedData.descricao || 'Adicionado via WhatsApp',
      data_transacao: new Date().toISOString(),
      status: 'EFETIVADA',
      ...(extractedData.categoria_id && { categoria_id: extractedData.categoria_id }),
      ...(extractedData.subcategoria_id && { subcategoria_id: extractedData.subcategoria_id }),
    }

    const transaction = await TransactionService.createTransaction(usuarioId, payload)

    // 4. Montar detalhe legível para o log de auditoria
    let catNome = 'Sem categoria'
    let subNome = ''
    if (extractedData.categoria_id) {
      const cat = categorias.find((c) => c.id === extractedData.categoria_id)
      if (cat) {
        catNome = cat.nome || catNome
        if (extractedData.subcategoria_id && Array.isArray(cat.subcategorias)) {
          const sub = cat.subcategorias.find((s) => s.id === extractedData.subcategoria_id)
          if (sub) subNome = sub.nome
        }
      }
    }

    const valorNum = Number(extractedData.valor) || 0
    const detalheSucesso = `Lançado: ${extractedData.tipo} R$${valorNum.toFixed(2)} - ${catNome}${subNome ? ' / ' + subNome : ''}`

    log.info(`[WhatsAppTransactionService] Transação salva: ${transaction.id} — ${detalheSucesso}`)

    return { transaction, detalheSucesso, catNome, subNome }
  },
}

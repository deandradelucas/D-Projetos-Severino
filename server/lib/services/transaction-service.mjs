import { log } from '../logger.mjs'
import { inserirTransacao } from '../transacoes.mjs'
import { criarRegraRecorrenciaDia1 } from '../recorrencias-mensais.mjs'

/**
 * TransactionService — Camada de serviço para orquestrar operações de transações.
 * Centraliza lógica de negócio que vai além do simples CRUD.
 */
export const TransactionService = {
  /**
   * Cria uma nova transação e processa efeitos colaterais (recorrência, etc).
   */
  async createTransaction(userId, payload) {
    if (!userId) throw new Error('ID do usuário é obrigatório.')

    // 1. Garantir o ID do usuário no payload
    const dataToInsert = { ...payload, usuario_id: userId }

    // 2. Persistência básica
    let transaction = await inserirTransacao(dataToInsert)
    if (!transaction) throw new Error('Falha ao inserir transação.')

    // 3. Lógica de Recorrência "Dia 1" (fixo mensal)
    // Se o usuário marcou o check e não é uma recorrência de parcelamento comum
    const rawDia1 = payload.recorrencia_dia_1
    const marcaRecorrenciaDia1 = 
      rawDia1 === true || rawDia1 === 'true' || rawDia1 === 1 || rawDia1 === '1'
    
    const querRecorrenciaDia1 = 
      marcaRecorrenciaDia1 && 
      !(payload.recorrencia && Number(payload.recorrencia.quantidade) > 1)

    if (querRecorrenciaDia1) {
      try {
        const { transacaoAtualizada } = await criarRegraRecorrenciaDia1(userId, transaction)
        if (transacaoAtualizada?.recorrencia_mensal_id) {
          transaction = { 
            ...transaction, 
            recorrencia_mensal_id: transacaoAtualizada.recorrencia_mensal_id 
          }
        }
      } catch (e) {
        log.error('[TransactionService] Falha ao criar regra de recorrência dia 1:', e)
        // Não falhamos a criação da transação por causa da recorrência (graceful degradation)
      }
    }

    return transaction
  }
}

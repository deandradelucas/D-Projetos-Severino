import { log } from '../logger.mjs'
import { inserirTransacao } from '../transacoes.mjs'
import { criarRegraRecorrenciaDia1 } from '../recorrencias-mensais.mjs'
import { getSupabaseAdmin } from '../supabase-admin.mjs'

/** Avança N meses mantendo o dia original; clampa para o último dia do mês quando necessário. */
function addMonths(dateIso, months) {
  const d = new Date(dateIso)
  const day = d.getUTCDate()
  const rawMonth = d.getUTCMonth() + months
  const ny = d.getUTCFullYear() + Math.floor(rawMonth / 12)
  const nm = ((rawMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return new Date(Date.UTC(ny, nm, Math.min(day, lastDay), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
}

/**
 * TransactionService — Camada de serviço para orquestrar operações de transações.
 */
export const TransactionService = {
  /**
   * Cria uma nova transação simples e processa efeitos colaterais (recorrência).
   */
  async createTransaction(userId, payload, opts = {}) {
    if (!userId) throw new Error('ID do usuário é obrigatório.')

    const lp = opts.lancadoPorUsuarioId ? String(opts.lancadoPorUsuarioId).trim() : ''
    const dataToInsert = { ...payload, usuario_id: userId }
    if (lp) dataToInsert.lancado_por_usuario_id = lp

    let transaction = await inserirTransacao(dataToInsert)
    if (!transaction) throw new Error('Falha ao inserir transação.')

    const rawDia1 = payload.recorrencia_dia_1
    const marcaRecorrenciaDia1 =
      rawDia1 === true || rawDia1 === 'true' || rawDia1 === 1 || rawDia1 === '1'

    if (marcaRecorrenciaDia1) {
      try {
        const { transacaoAtualizada } = await criarRegraRecorrenciaDia1(userId, transaction)
        if (transacaoAtualizada?.recorrencia_mensal_id) {
          transaction = {
            ...transaction,
            recorrencia_mensal_id: transacaoAtualizada.recorrencia_mensal_id,
          }
        }
      } catch (e) {
        log.error('[TransactionService] Falha ao criar regra de recorrência dia 1:', e)
      }
    }

    return transaction
  },

  /**
   * Cria N parcelas de uma compra parcelada atomicamente.
   * Cada parcela cai no mesmo dia do mês, avançando 1 mês por parcela.
   * A última parcela absorve diferença de centavos.
   */
  async createParcelamento(userId, payload, opts = {}) {
    if (!userId) throw new Error('ID do usuário é obrigatório.')

    const supabase = getSupabaseAdmin()
    const n = parseInt(payload.parcelamento.num_parcelas, 10)
    const valorTotal = parseFloat(payload.valor)
    const lp = opts.lancadoPorUsuarioId ? String(opts.lancadoPorUsuarioId).trim() : ''

    // Calcula valor por parcela com arredondamento — diferença vai para a última
    const valorBase = Math.floor((valorTotal / n) * 100) / 100
    const ajuste = Math.round((valorTotal - valorBase * n) * 100) / 100

    const grupoId = crypto.randomUUID()
    const descricaoBase = String(payload.descricao || '').trim()
    const categoriaId = payload.categoria_id || null
    const subcategoriaId = payload.subcategoria_id || null
    const status = String(payload.status || 'EFETIVADA').trim().toUpperCase()

    const agora = new Date()
    const rows = []
    for (let i = 1; i <= n; i++) {
      const dataParcela = addMonths(payload.data_transacao, i - 1)
      const dataIso = dataParcela.toISOString()
      const valor = i === n ? +(valorBase + ajuste).toFixed(2) : valorBase
      const descricao = descricaoBase ? `${descricaoBase} (${i}/${n})` : `Parcela ${i}/${n}`

      // Parcelas com data futura ficam PENDENTE; primeira (ou passadas) ficam com o status escolhido
      const statusParcela = dataParcela > agora ? 'PENDENTE' : status

      const row = {
        usuario_id: userId,
        tipo: payload.tipo,
        valor,
        descricao,
        data_transacao: dataIso,
        status: statusParcela,
        categoria_id: categoriaId,
        subcategoria_id: subcategoriaId,
        recorrente_grupo_id: grupoId,
        recorrente_index: i,
        recorrente_total: n,
      }
      if (lp) row.lancado_por_usuario_id = lp
      rows.push(row)
    }

    const { data, error } = await supabase.from('transacoes').insert(rows).select('id, recorrente_index')
    if (error) throw error

    return { grupo_id: grupoId, total_parcelas: n, parcelas: data }
  },
}

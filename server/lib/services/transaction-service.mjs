import { log } from '../logger.mjs'
import { inserirTransacao } from '../transacoes.mjs'
import { criarRegraRecorrenciaDia1 } from '../recorrencias-mensais.mjs'
import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { vencimentoCartaoParaData } from '../cartao-vencimento.mjs'

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
    const cartaoId = payload.cartao_id || null
    const status = String(payload.status || 'EFETIVADA').trim().toUpperCase()

    const agora = new Date()
    const hojeStr = agora.toISOString().slice(0, 10) // "YYYY-MM-DD" UTC

    // Vencimento da 1ª parcela (base da série, índice 0). Fonte de verdade:
    //  - com cartão: próximo vencimento a partir da data da compra (lógica unificada
    //    com o front, server/lib/cartao-vencimento.mjs)
    //  - sem cartão: data_pagamento informada; senão a própria data da compra
    let vencimentoPrimeira = null
    if (cartaoId) {
      const { data: cartao } = await supabase
        .from('cartoes')
        .select('dia_vencimento')
        .eq('id', cartaoId)
        .maybeSingle()
      if (cartao?.dia_vencimento) {
        const v = vencimentoCartaoParaData(payload.data_transacao, cartao.dia_vencimento, 0)
        if (v) vencimentoPrimeira = `${v}T12:00:00Z`
      }
    }
    const dataPagamentoRaw = payload.parcelamento && payload.parcelamento.data_pagamento
    const baseDataParcelas =
      vencimentoPrimeira ||
      (dataPagamentoRaw && !Number.isNaN(Date.parse(String(dataPagamentoRaw)))
        ? String(dataPagamentoRaw)
        : payload.data_transacao)

    // Parcela inicial: override manual para começar de uma parcela específica
    // (ex.: parcela_inicial=3 não lança 1 e 2). Por padrão (1) lança TODAS as parcelas;
    // as já vencidas entram como pagas (status abaixo), preservando o histórico.
    const parcelaInicial = Math.max(1, parseInt(payload.parcelamento.parcela_inicial || '1', 10) || 1)

    // Data ORIGINAL da compra (igual para todas as parcelas). data_transacao guarda o
    // vencimento de cada parcela; data_compra preserva quando a compra foi feita.
    const dataCompraRaw = payload.data_transacao
    const dataCompraIso =
      dataCompraRaw && !Number.isNaN(Date.parse(String(dataCompraRaw)))
        ? new Date(dataCompraRaw).toISOString()
        : null

    const rows = []
    for (let i = parcelaInicial; i <= n; i++) {
      // base = vencimento da 1ª parcela; parcela i vence base + (i-1) meses.
      const dataParcela = addMonths(baseDataParcelas, i - 1)
      const dataIso = dataParcela.toISOString()
      const valor = i === n ? +(valorBase + ajuste).toFixed(2) : valorBase
      const descricao = descricaoBase ? `${descricaoBase} (${i}/${n})` : `Parcela ${i}/${n}`

      // Parcela já vencida (anterior a hoje) entra como paga (status escolhido);
      // hoje e futuro = PENDENTE.
      const dataParcelaStr = dataIso.slice(0, 10)
      const statusParcela = dataParcelaStr < hojeStr ? status : 'PENDENTE'

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
      if (dataCompraIso) row.data_compra = dataCompraIso
      if (cartaoId) row.cartao_id = cartaoId
      if (lp) row.lancado_por_usuario_id = lp
      rows.push(row)
    }

    const { data, error } = await supabase.from('transacoes').insert(rows).select('id, recorrente_index')
    if (error) throw error

    return { grupo_id: grupoId, total_parcelas: n, parcelas: data }
  },
}

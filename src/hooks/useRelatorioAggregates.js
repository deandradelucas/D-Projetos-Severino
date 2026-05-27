import { useMemo } from 'react'
import {
  transacaoDiaKey,
  transacaoMesKey,
  labelMesBr,
  tipoNormalizado,
  isDespesaRecorrente,
  parseValorTransacao,
} from '../lib/transacaoUtils'

/** Diferença entre dois meses 'YYYY-MM' (b - a). */
function monthDiffYm(a, b) {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

/**
 * Computa agregados do relatório a partir das transações reais.
 *
 * @param {Array} transacoes
 * @param {Object} [options]
 * @param {Array<{
 *   id: string,
 *   tipo: string,
 *   valor: number|string,
 *   ativo?: boolean,
 *   mes_inicio?: string|null,
 *   total_meses?: number|null,
 * }>} [options.recorrenciasAtivas] — regras mensais ativas. Quando passadas,
 *   o gráfico de **Recorrentes** projeta o valor mensal nos meses do período
 *   onde ainda não há lançamento real (ex.: assinatura criada com "Prazo
 *   indeterminado" cujo cron ainda não gerou a transação do mês).
 * @param {Array<string>} [options.periodoMeses] — lista de meses 'YYYY-MM'
 *   no período do relatório (vinda dos filtros de data). Sem ela, usa apenas
 *   os meses presentes nas transações reais.
 */
export function computeRelatorioAggregates(transacoes, options = {}) {
  const { recorrenciasAtivas = [], periodoMeses = null } = options

  let receitas = 0
  let despesas = 0

  const mesMap = {}
  const recorrentesMesMap = {}
  const catMap = {}
  const recCatMap = {}
  // Mapeia regraId → Set<ymKey> com meses que JÁ têm lançamento real.
  // Permite projetar a recorrência sem duplicar quando o cron já gerou.
  const lancamentosPorRegra = new Map()

  for (const t of transacoes || []) {
    const dRaw = transacaoDiaKey(t.data_transacao)
    if (!dRaw) continue
    const valorNum = parseValorTransacao(t)
    const tipo = tipoNormalizado(t.tipo)

    const mRaw = transacaoMesKey(t.data_transacao)
    if (mRaw) {
      if (!mesMap[mRaw]) {
        mesMap[mRaw] = { Receitas: 0, Despesas: 0 }
      }
      if (tipo === 'RECEITA') {
        mesMap[mRaw].Receitas += valorNum
      } else {
        mesMap[mRaw].Despesas += valorNum
      }
      if (isDespesaRecorrente(t)) {
        recorrentesMesMap[mRaw] = (recorrentesMesMap[mRaw] || 0) + valorNum
      }
      if (t.recorrencia_mensal_id) {
        if (!lancamentosPorRegra.has(t.recorrencia_mensal_id)) {
          lancamentosPorRegra.set(t.recorrencia_mensal_id, new Set())
        }
        lancamentosPorRegra.get(t.recorrencia_mensal_id).add(mRaw)
      }
    }

    if (tipo === 'RECEITA') {
      receitas += valorNum
      const cn = t.categorias?.nome || 'Sem categoria'
      recCatMap[cn] = (recCatMap[cn] || 0) + valorNum
    } else {
      despesas += valorNum
      const catName = t.categorias?.nome || 'Sem categoria'
      catMap[catName] = (catMap[catName] || 0) + valorNum
    }
  }

  // Projeção das recorrências ativas: garante que assinaturas/streams
  // com "Prazo indeterminado" entrem no gráfico mesmo nos meses em que o
  // cron ainda não gerou o lançamento real.
  const mesesParaProjecao =
    periodoMeses && periodoMeses.length > 0 ? periodoMeses : Object.keys(mesMap)

  for (const regra of recorrenciasAtivas || []) {
    if (!regra?.id) continue
    if (tipoNormalizado(regra.tipo) !== 'DESPESA') continue
    const valorMensal = Number(regra.valor) || 0
    if (valorMensal <= 0) continue

    const lancamentos = lancamentosPorRegra.get(regra.id) || new Set()
    const mesInicio = typeof regra.mes_inicio === 'string' ? regra.mes_inicio : null
    const totalMeses =
      Number.isFinite(Number(regra.total_meses)) && Number(regra.total_meses) > 0
        ? Number(regra.total_meses)
        : null

    for (const ym of mesesParaProjecao) {
      if (lancamentos.has(ym)) continue
      // Não projeta antes do mês de início da regra
      if (mesInicio && monthDiffYm(mesInicio, ym) < 0) continue
      // Respeita prazo (quando a regra tem total_meses definido)
      if (totalMeses != null && mesInicio) {
        if (monthDiffYm(mesInicio, ym) >= totalMeses) continue
      }
      recorrentesMesMap[ym] = (recorrentesMesMap[ym] || 0) + valorMensal
    }
  }

  // Para o gráfico de Recorrentes, considera todos os meses do período + os
  // meses que receberam projeção. (Evita "barras invisíveis" mesmo quando
  // existe valor projetado num mês sem transações reais.)
  const sortedMesKeys = Object.keys(mesMap).sort()
  const recorrentesMesKeys = Array.from(
    new Set([...sortedMesKeys, ...mesesParaProjecao, ...Object.keys(recorrentesMesMap)])
  ).sort()

  const chartDataPorMes = sortedMesKeys.map((k) => {
    const row = mesMap[k]
    return {
      name: labelMesBr(k),
      Receitas: row.Receitas,
      Despesas: row.Despesas,
    }
  })

  const chartDataComprasRecorrentesMes = recorrentesMesKeys.map((k) => ({
    name: labelMesBr(k),
    total: recorrentesMesMap[k] || 0,
  }))
  const totalComprasRecorrentesPeriodo = recorrentesMesKeys.reduce(
    (acc, k) => acc + (recorrentesMesMap[k] || 0),
    0
  )

  const chartDataPorCategoria = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const chartDataReceitasPorCategoria = Object.entries(recCatMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return {
    summary: { receitas, despesas, saldo: receitas - despesas },
    chartDataPorMes,
    chartDataComprasRecorrentesMes,
    totalComprasRecorrentesPeriodo,
    chartDataPorCategoria,
    chartDataReceitasPorCategoria,
  }
}

export function useRelatorioAggregates(transacoes, options) {
  return useMemo(
    () => computeRelatorioAggregates(transacoes, options),
    [transacoes, options]
  )
}

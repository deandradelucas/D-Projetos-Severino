import { useMemo } from 'react'
import {
  transacaoDiaKey,
  transacaoMesKey,
  labelMesBr,
  tipoNormalizado,
  isDespesaRecorrente,
  parseValorTransacao,
} from '../lib/transacaoUtils'

export function computeRelatorioAggregates(transacoes) {
  let receitas = 0
  let despesas = 0

  const mesMap = {}
  const recorrentesMesMap = {}
  const catMap = {}
  const recCatMap = {}

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

  const sortedMesKeys = Object.keys(mesMap).sort()
  const chartDataPorMes = sortedMesKeys.map((k) => {
    const row = mesMap[k]
    return {
      name: labelMesBr(k),
      Receitas: row.Receitas,
      Despesas: row.Despesas,
    }
  })

  const chartDataComprasRecorrentesMes = sortedMesKeys.map((k) => ({
    name: labelMesBr(k),
    total: recorrentesMesMap[k] || 0,
  }))
  const totalComprasRecorrentesPeriodo = sortedMesKeys.reduce(
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

export function useRelatorioAggregates(transacoes) {
  return useMemo(() => computeRelatorioAggregates(transacoes), [transacoes])
}

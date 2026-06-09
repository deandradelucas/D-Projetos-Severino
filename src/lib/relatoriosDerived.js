// Cálculos derivados puros da página de Relatórios.
// Extraídos de pages/Relatorios.jsx (corpos dos useMemo) — sem React, testáveis.

import { formatLocalDateISO } from './dateUtils'
import { tipoNormalizado, parseValorTransacao, isDespesaRecorrente } from './transacaoUtils'

/** Período anterior de mesmo tamanho, imediatamente antes do filtrado (R1).
 *  Retorna { dataInicio, dataFim } ISO local, ou null se filtro incompleto/inválido. */
export function computePrevRange(filters) {
  if (!filters.dataInicio || !filters.dataFim) return null
  const ini = new Date(`${filters.dataInicio}T00:00:00`)
  const fim = new Date(`${filters.dataFim}T00:00:00`)
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return null
  const lenDays = Math.round((fim - ini) / 86400000) + 1
  const prevFim = new Date(ini); prevFim.setDate(prevFim.getDate() - 1)
  const prevIni = new Date(prevFim); prevIni.setDate(prevIni.getDate() - (lenDays - 1))
  return { dataInicio: formatLocalDateISO(prevIni), dataFim: formatLocalDateISO(prevFim) }
}

/** Variação percentual de `cur` vs `prev`. Retorna null quando prev é 0/nulo. */
export function pctDelta(cur, prev) {
  if (prev == null || prev === 0) return null
  return ((cur - prev) / Math.abs(prev)) * 100
}

/** Saldo acumulado mês a mês (R6) a partir de chartDataPorMes ({name, Receitas, Despesas}). */
export function computeSaldoAcumulado(chartDataPorMes) {
  let acc = 0
  return chartDataPorMes.map((m) => {
    acc += (m.Receitas - m.Despesas)
    return { name: m.name, Saldo: Math.round(acc * 100) / 100 }
  })
}

/** Top 5 maiores despesas do período (R7). */
export function computeTop5Despesas(transacoes) {
  return (transacoes || [])
    .filter((t) => tipoNormalizado(t.tipo) === 'DESPESA')
    .map((t) => ({
      id: t.id,
      desc: t.descricao || t.categorias?.nome || 'Despesa',
      cat: t.categorias?.nome || 'Sem categoria',
      valor: parseValorTransacao(t),
      data: t.data_transacao,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5)
}

/** Orçado vs real (R3): gasto por categoria no período vs limite mensal definido. */
export function computeOrcadoVsReal(limitesOrcamento, categorias, chartDataPorCategoria) {
  if (!limitesOrcamento.length) return []
  const spendByName = new Map(chartDataPorCategoria.map((c) => [c.name, c.value]))
  return limitesOrcamento
    .map((l) => {
      const cat = categorias.find((c) => String(c.id) === String(l.categoria_id))
      const limite = Number(l.limite_mensal) || 0
      if (!cat || limite <= 0) return null
      const gasto = spendByName.get(cat.nome) || 0
      return {
        id: l.categoria_id,
        nome: cat.nome,
        limite,
        gasto,
        pct: Math.min(100, Math.round((gasto / limite) * 100)),
        excedido: gasto > limite,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.gasto - a.gasto)
}

/** Fixo vs variável + comprometimento da renda (Feature 2).
 *  Fixo = despesas recorrentes/parceladas; resto = variável. Usa transações reais. */
export function computeFixoVsVariavel(transacoes, receitas) {
  let fixo = 0
  let variavel = 0
  for (const t of transacoes || []) {
    if (tipoNormalizado(t.tipo) !== 'DESPESA') continue
    const v = parseValorTransacao(t)
    if (isDespesaRecorrente(t)) fixo += v
    else variavel += v
  }
  const total = fixo + variavel
  return {
    fixo,
    variavel,
    total,
    pctFixo: total > 0 ? (fixo / total) * 100 : 0,
    comprometimento: receitas > 0 ? (fixo / receitas) * 100 : null,
  }
}

/** Mediana de uma lista de números (robusta a outliers). */
function mediana(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Projeção de fim do período (R2) — versão que NÃO extrapola gastos pontuais.
 *
 * O que já foi gasto é fato (não multiplica). A projeção apenas estima os dias
 * que ainda faltam, usando o ritmo de gasto do dia a dia. Desse ritmo são
 * excluídos:
 *   - recorrências/parcelas (não repetem de novo dentro do mesmo mês);
 *   - gastos atípicos/pontuais (outliers — ex.: fatura, compra grande única),
 *     definidos como transação > 4× a mediana das despesas cotidianas.
 *
 * despProj = despesasJáGastas + ritmoDiárioCotidiano × diasRestantes
 *
 * Retorna null quando o período não inclui "hoje" ou já terminou (sem dias a
 * projetar) — nesses casos a tela não mostra o card de projeção.
 */
export function computeProjecaoFimPeriodo(transacoes, summary, filters, hoje = new Date()) {
  if (!filters?.dataInicio || !filters?.dataFim) return null
  const ini = new Date(`${filters.dataInicio}T00:00:00`)
  const fim = new Date(`${filters.dataFim}T00:00:00`)
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return null
  const hojeMid = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  if (hojeMid < ini || hojeMid >= fim) return null // período não inclui hoje, ou já acabou

  const diasPeriodo = Math.round((fim - ini) / 86400000) + 1
  const diasDecorridos = Math.max(1, Math.round((hojeMid - ini) / 86400000) + 1)
  const diasRestantes = diasPeriodo - diasDecorridos
  if (diasRestantes <= 0) return null

  // Despesas cotidianas = nem recorrente/parcela. Sobre elas, descarta outliers.
  const cotidianas = (transacoes || [])
    .filter((t) => tipoNormalizado(t.tipo) === 'DESPESA' && !isDespesaRecorrente(t))
    .map(parseValorTransacao)
  const med = mediana(cotidianas)
  const limiteOutlier = med > 0 ? med * 4 : Infinity
  const baseRitmo = cotidianas.reduce((s, v) => (v <= limiteOutlier ? s + v : s), 0)

  const ritmoDiario = baseRitmo / diasDecorridos
  const despProj = summary.despesas + ritmoDiario * diasRestantes
  return {
    despProj,
    saldoProj: summary.receitas - despProj,
    ritmoDiario,
    diasRestantes,
    diasDecorridos,
  }
}

/** Variação por categoria (DESPESAS) vs período anterior (Feature 1).
 *  Vazio quando não há período anterior ou quando há filtro de categoria. */
export function computeVariacaoCategorias(prevCategorias, chartDataPorCategoria, categoriaIdFilter) {
  if (!prevCategorias || categoriaIdFilter) return []
  const prevMap = new Map(prevCategorias.map((c) => [c.name, c.value]))
  const curMap = new Map(chartDataPorCategoria.map((c) => [c.name, c.value]))
  const names = new Set([...prevMap.keys(), ...curMap.keys()])
  const rows = []
  for (const name of names) {
    if (name === 'Sem categoria') continue
    const cur = curMap.get(name) || 0
    const prev = prevMap.get(name) || 0
    const diff = cur - prev
    if (Math.abs(diff) < 1) continue
    const pct = prev > 0 ? (diff / prev) * 100 : null
    rows.push({ name, cur, prev, diff, pct })
  }
  rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  return rows
}

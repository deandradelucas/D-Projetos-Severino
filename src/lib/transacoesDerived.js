// Cálculos derivados puros da página de Transações.
// Extraídos de pages/Transacoes.jsx (corpos dos useMemo) — sem React, testáveis.

import { transacaoDiaKey } from './transacaoUtils'

/** Agrupa transações em grupos parcelados/mensais com métricas de progresso.
 *  Espelha o memo `gruposParcelados` (a guarda de filtro ativo fica no componente). */
export function construirGruposParcelados(transacoes) {
  const map = new Map()
  for (const t of transacoes) {
    let key = null
    let kind = null
    if (t.recorrente_grupo_id && t.recorrente_index) {
      key = `p:${t.recorrente_grupo_id}`
      kind = 'parcelado'
    } else if (t.recorrencia_mensal_id) {
      key = `m:${t.recorrencia_mensal_id}`
      kind = 'mensal'
    }
    if (!key) continue
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        kind,
        group_id: t.recorrente_grupo_id || t.recorrencia_mensal_id,
        parcelas: [],
        valor_total: 0,
        tipo: t.tipo,
        recorrente_total: t.recorrente_total || null,
        categorias: t.categorias,
        subcategorias: t.subcategorias,
      })
    }
    const g = map.get(key)
    g.parcelas.push(t)
    g.valor_total += Math.abs(parseFloat(t.valor) || 0)
  }
  const out = []
  const hojeKey = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  for (const g of map.values()) {
    if (g.kind === 'parcelado') {
      g.parcelas.sort((a, b) => (a.recorrente_index || 0) - (b.recorrente_index || 0))
    } else {
      g.parcelas.sort((a, b) => new Date(a.data_transacao || 0) - new Date(b.data_transacao || 0))
    }
    const primeira = g.parcelas[0]
    g.descricao_base =
      (primeira?.descricao && String(primeira.descricao).replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()) ||
      (g.subcategorias?.nome && String(g.subcategorias.nome).trim()) ||
      (g.categorias?.nome && String(g.categorias.nome).trim()) ||
      (g.kind === 'mensal' ? 'Assinatura mensal' : 'Compra parcelada')
    g.data_inicio = primeira?.data_transacao || null

    // ── Métricas de progresso ──
    let pagas = 0
    let valorPago = 0
    let proxima = null
    let temAtrasada = false
    for (const p of g.parcelas) {
      const pendente = p.status === 'PENDENTE'
      const v = Math.abs(parseFloat(p.valor) || 0)
      const key = String(p.data_transacao || '').slice(0, 10)
      if (!pendente) {
        pagas += 1
        valorPago += v
      } else {
        // pendente no passado = atrasada
        if (key && key < hojeKey) temAtrasada = true
        // próxima = primeira pendente com data >= hoje
        if (key && key >= hojeKey && (!proxima || key < String(proxima.data_transacao).slice(0, 10))) {
          proxima = p
        }
      }
    }
    // Se não tem nenhuma pendente futura, próxima = última pendente (ou null)
    if (!proxima) {
      for (const p of g.parcelas) {
        if (p.status === 'PENDENTE') { proxima = p; break }
      }
    }
    g.parcelas_pagas = pagas
    g.parcelas_total = g.kind === 'parcelado' ? (g.recorrente_total || g.parcelas.length) : g.parcelas.length
    g.parcelas_pct = Math.round((pagas / Math.max(g.parcelas_total, 1)) * 100)
    g.valor_pago = valorPago
    g.valor_restante = g.valor_total - valorPago
    g.proxima_parcela = proxima
    g.status = pagas === g.parcelas_total ? 'concluida' : temAtrasada ? 'atrasada' : pagas > 0 ? 'em-dia' : 'futura'

    out.push(g)
  }
  out.sort((a, b) => new Date(b.data_inicio || 0) - new Date(a.data_inicio || 0))
  return out
}

/** Aplica search + status filter + sort nos grupos parcelados. Espelha `gruposParceladosVisiveis`. */
export function filtrarGruposParcelados(gruposParcelados, parcSearch, parcStatusFilter, parcSort) {
  if (!gruposParcelados) return null
  const termo = parcSearch.trim().toLowerCase()
  let arr = gruposParcelados.filter((g) => {
    if (termo) {
      const desc = (g.descricao_base || '').toLowerCase()
      const cat = (g.categorias?.nome || '').toLowerCase()
      const sub = (g.subcategorias?.nome || '').toLowerCase()
      if (!desc.includes(termo) && !cat.includes(termo) && !sub.includes(termo)) return false
    }
    if (parcStatusFilter === 'em-dia' && g.status !== 'em-dia') return false
    if (parcStatusFilter === 'atrasadas' && g.status !== 'atrasada') return false
    if (parcStatusFilter === 'concluidas' && g.status !== 'concluida') return false
    if (parcStatusFilter === 'proximas') {
      // Próximas a vencer: tem proxima parcela em até 14 dias
      if (!g.proxima_parcela) return false
      const key = String(g.proxima_parcela.data_transacao || '').slice(0, 10)
      const hoje = new Date()
      const limite = new Date(hoje); limite.setDate(limite.getDate() + 14)
      const limiteKey = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`
      if (key < `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}` || key > limiteKey) return false
    }
    return true
  })
  arr = arr.slice() // copy
  if (parcSort === 'value') arr.sort((a, b) => b.valor_total - a.valor_total)
  else if (parcSort === 'parcels') arr.sort((a, b) => b.parcelas_total - a.parcelas_total)
  else if (parcSort === 'progress') arr.sort((a, b) => b.parcelas_pct - a.parcelas_pct)
  // 'recent' já está ordenado por data_inicio desc
  return arr
}

/** Segmenta grupos em parcelados e mensais. Espelha `gruposPorSegmento`. */
export function segmentarGrupos(gruposParceladosVisiveis) {
  if (!gruposParceladosVisiveis) return null
  return {
    parcelados: gruposParceladosVisiveis.filter((g) => g.kind === 'parcelado'),
    mensais: gruposParceladosVisiveis.filter((g) => g.kind === 'mensal'),
  }
}

/** Totais dos parcelados (mês corrente, geral, pago, restante, falta no mês). Espelha `totaisParcelados`. */
export function calcularTotaisParcelados(gruposParcelados) {
  if (!gruposParcelados) return null
  const agora = new Date()
  const ymAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  let totalMes = 0
  let totalGeral = 0
  for (const g of gruposParcelados) {
    totalGeral += g.valor_total
    if (g.kind === 'mensal' && g.parcelas.length > 0) {
      // Assinatura/stream sem prazo: contabiliza o valor mensal mesmo que
      // o lançamento do mês atual ainda não tenha sido gerado pelo cron de
      // recorrências (evita o footer "esquecer" o gasto da assinatura).
      // Procura primeiro um lançamento já existente para o mês atual; se
      // não houver, usa o valor da última parcela como referência.
      let valorMes = 0
      for (const p of g.parcelas) {
        const d = p.data_transacao ? new Date(p.data_transacao) : null
        if (!d || Number.isNaN(d.getTime())) continue
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (ym === ymAtual) {
          valorMes = Math.abs(parseFloat(p.valor) || 0)
          break
        }
      }
      if (!valorMes) {
        const ultima = g.parcelas[g.parcelas.length - 1]
        valorMes = Math.abs(parseFloat(ultima?.valor) || 0)
      }
      totalMes += valorMes
    } else {
      // Parcelado fixo: só conta a parcela que vence no mês corrente.
      for (const p of g.parcelas) {
        const d = p.data_transacao ? new Date(p.data_transacao) : null
        if (!d || Number.isNaN(d.getTime())) continue
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (ym === ymAtual) totalMes += Math.abs(parseFloat(p.valor) || 0)
      }
    }
  }
  // Extras: pago total e restante total
  let totalPago = 0
  let totalRestante = 0
  for (const g of gruposParcelados) {
    totalPago += g.valor_pago || 0
    totalRestante += g.valor_restante || 0
  }
  // Falta no mês corrente = total do mês - já pago no mês corrente
  let pagoNoMes = 0
  for (const g of gruposParcelados) {
    for (const p of g.parcelas) {
      const d = p.data_transacao ? new Date(p.data_transacao) : null
      if (!d || Number.isNaN(d.getTime())) continue
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (ym === ymAtual && p.status !== 'PENDENTE') {
        pagoNoMes += Math.abs(parseFloat(p.valor) || 0)
      }
    }
  }
  const faltaNoMes = Math.max(totalMes - pagoNoMes, 0)
  return { totalMes, totalGeral, totalPago, totalRestante, faltaNoMes }
}

/** Filtra transações por busca rápida + filtro rápido (hoje/7d/30d/receitas/despesas/pendentes).
 *  Espelha `transacoesVisiveis`. */
export function filtrarTransacoesVisiveis(transacoes, quickSearch, quickFilter) {
  const termo = quickSearch.trim().toLowerCase()
  const hoje = new Date()
  const hojeKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const seteDiasAtras = new Date(hoje)
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 6)
  const seteDiasKey = `${seteDiasAtras.getFullYear()}-${String(seteDiasAtras.getMonth() + 1).padStart(2, '0')}-${String(seteDiasAtras.getDate()).padStart(2, '0')}`
  const trintaDiasAtras = new Date(hoje)
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 29)
  const trintaDiasKey = `${trintaDiasAtras.getFullYear()}-${String(trintaDiasAtras.getMonth() + 1).padStart(2, '0')}-${String(trintaDiasAtras.getDate()).padStart(2, '0')}`

  return transacoes.filter((t) => {
    if (termo) {
      const desc = (t.descricao || '').toLowerCase()
      const cat = (t.categorias?.nome || '').toLowerCase()
      const sub = (t.subcategorias?.nome || '').toLowerCase()
      if (!desc.includes(termo) && !cat.includes(termo) && !sub.includes(termo)) return false
    }
    if (quickFilter) {
      const key = transacaoDiaKey(t.data_transacao)
      if (quickFilter === 'hoje' && key !== hojeKey) return false
      if (quickFilter === '7d' && (key < seteDiasKey || key > hojeKey)) return false
      if (quickFilter === '30d' && (key < trintaDiasKey || key > hojeKey)) return false
      if (quickFilter === 'receitas' && t.tipo !== 'RECEITA') return false
      if (quickFilter === 'despesas' && t.tipo !== 'DESPESA') return false
      if (quickFilter === 'pendentes' && t.status !== 'PENDENTE') return false
    }
    return true
  })
}

/** Agrupa transações por dia (com label Hoje/Ontem/data) e totais. Espelha `transacoesPorDia`. */
export function agruparTransacoesPorDia(transacoesVisiveis) {
  const grupos = []
  const indexMap = new Map()
  const hoje = new Date()
  const hojeKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)
  const ontemKey = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, '0')}-${String(ontem.getDate()).padStart(2, '0')}`

  const fmtLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

  for (const t of transacoesVisiveis) {
    // Parcelas são agrupadas pela data da COMPRA (data_compra); demais pela data
    // da transação. Mantém a linha e o cabeçalho do dia consistentes.
    const raw = t.recorrente_index && t.data_compra ? t.data_compra : t.data_transacao
    if (!raw) continue
    const key = transacaoDiaKey(raw)
    let group = indexMap.get(key)
    if (!group) {
      let label
      if (key === hojeKey) label = 'Hoje'
      else if (key === ontemKey) label = 'Ontem'
      else {
        const [y, m, d] = key.split('-').map(Number)
        const dt = new Date(y, m - 1, d, 12)
        label = cap(fmtLong.format(dt).replace(/\.$/, '').replace(/\.\s/g, ' '))
      }
      group = { key, label, txs: [], totalReceitas: 0, totalDespesas: 0 }
      grupos.push(group)
      indexMap.set(key, group)
    }
    group.txs.push(t)
    if (t.status !== 'PENDENTE') {
      const v = Math.abs(parseFloat(t.valor) || 0)
      if (t.tipo === 'RECEITA') group.totalReceitas += v
      else group.totalDespesas += v
    }
  }
  // Reordena os grupos por data exibida (desc) — parcelas reagrupadas pela data da
  // compra precisam cair na posição cronológica certa, não na ordem do backend.
  grupos.sort((a, b) => b.key.localeCompare(a.key))
  return grupos
}

/** Resumo do filtro atual (entradas/saídas/saldo/count). Espelha `quickTotals`. */
export function calcularQuickTotals(transacoesVisiveis) {
  let entradas = 0, saidas = 0
  for (const t of transacoesVisiveis) {
    if (t.status === 'PENDENTE') continue
    const v = Math.abs(parseFloat(t.valor) || 0)
    if (t.tipo === 'RECEITA') entradas += v
    else saidas += v
  }
  return { entradas, saidas, saldo: entradas - saidas, count: transacoesVisiveis.length }
}

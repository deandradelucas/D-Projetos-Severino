import { getSupabaseAdmin } from './supabase-admin.mjs'

/** Primeiro dia do mês `offset` meses atrás (offset 0 = mês atual), em YYYY-MM-01. */
function firstDayMonthsAgoISO(offset) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

/** Primeiro dia do mês seguinte ao atual (limite superior exclusivo). */
function firstDayNextMonthISO() {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

/** Lista contígua de 'YYYY-MM' do início até o mês atual (inclusive). */
function listaMeses(meses) {
  const out = []
  const now = new Date()
  for (let i = meses - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/**
 * Resumo mensal de receitas/despesas dos últimos `meses` meses (até o mês atual),
 * agregado no servidor. Escopo família via `usuarioId` (titular dos dados).
 * Só transações EFETIVADAS. Retorna SEMPRE a janela contígua completa, com zeros
 * nos meses sem movimento — para o gráfico de linha do tempo não ter buracos.
 *
 * @param {string} usuarioId
 * @param {{ meses?: number }} [opts]
 * @returns {Promise<Array<{ ym: string, receitas: number, despesas: number }>>}
 */
export async function getResumoMensal(usuarioId, opts = {}) {
  const uid = String(usuarioId || '').trim()
  if (!uid) return []
  const mesesRaw = Number(opts.meses)
  const meses = Number.isFinite(mesesRaw) ? Math.min(36, Math.max(1, Math.trunc(mesesRaw))) : 24

  const startISO = firstDayMonthsAgoISO(meses - 1)
  const endISO = firstDayNextMonthISO()
  const supabaseAdmin = getSupabaseAdmin()

  // Paginação: só 3 colunas leves; lê em páginas de 1000 até esgotar.
  const pageSize = 1000
  const acc = new Map() // ym -> { receitas, despesas }
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('transacoes')
      .select('tipo, valor, data_transacao')
      .eq('usuario_id', uid)
      .eq('status', 'EFETIVADA')
      .gte('data_transacao', startISO)
      .lt('data_transacao', endISO)
      .order('data_transacao', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    const rows = data || []
    for (const r of rows) {
      const raw = String(r.data_transacao || '')
      const ym = raw.slice(0, 7)
      if (!/^\d{4}-\d{2}$/.test(ym)) continue
      const v = Number(r.valor) || 0
      if (!acc.has(ym)) acc.set(ym, { receitas: 0, despesas: 0 })
      const slot = acc.get(ym)
      if (String(r.tipo || '').trim().toUpperCase() === 'RECEITA') slot.receitas += v
      else slot.despesas += v
    }
    if (rows.length < pageSize) break
  }

  return listaMeses(meses).map((ym) => ({
    ym,
    receitas: acc.get(ym)?.receitas || 0,
    despesas: acc.get(ym)?.despesas || 0,
  }))
}

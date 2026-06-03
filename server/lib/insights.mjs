import { getSupabaseAdmin } from './supabase-admin.mjs'
import { log } from './logger.mjs'
import { listarCartoesComResumo } from './cartoes.mjs'
import { listarMetas } from './metas.mjs'

// ── Helpers ──────────────────────────────────────────────────────────────────
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function diaSeguinte(d) {
  const x = new Date(d)
  x.setDate(x.getDate() + 1)
  return x
}
function clampDay(year, monthIdx, day) {
  const last = new Date(year, monthIdx + 1, 0).getDate()
  return Math.min(Math.max(1, day), last)
}
function brl(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function pctDelta(atual, anterior) {
  if (!anterior || anterior <= 0) return null
  return Math.round(((atual - anterior) / anterior) * 100)
}
function isDespesa(t) {
  return String(t.tipo || '').toUpperCase() === 'DESPESA'
}

/**
 * Gera insights determinísticos a partir dos dados do usuário (escopo já resolvido).
 * Sem chamadas de IA — custo zero de tokens.
 * Retorna lista ordenada por relevância. Cada item: { id, icone, tom, titulo, texto }.
 */
export async function gerarInsights(usuarioId) {
  const supabase = getSupabaseAdmin()
  const hoje = new Date()
  const y = hoje.getFullYear()
  const m = hoje.getMonth()
  const diaHoje = hoje.getDate()

  const inicioMesAtual = new Date(y, m, 1)
  const inicioMesPassado = new Date(y, m - 1, 1)
  const fimMesPassadoMesmoDia = new Date(y, m - 1, clampDay(y, m - 1, diaHoje))

  const insights = []

  // ── Transações despesa do mês atual + passado (1 query) ──
  let txs = []
  try {
    const { data, error } = await supabase
      .from('transacoes')
      .select('valor, tipo, descricao, data_transacao, categoria_id, categorias(nome)')
      .eq('usuario_id', usuarioId)
      .gte('data_transacao', ymd(inicioMesPassado))
      .lt('data_transacao', ymd(diaSeguinte(hoje)))
    if (error) throw error
    txs = data || []
  } catch (e) {
    log.warn('[insights] transacoes', e.message || e)
  }

  let gastoAtual = 0
  let gastoPassadoMesmoPeriodo = 0
  let gastoPassadoTotal = 0
  const catAtual = new Map()
  const catPassado = new Map()
  let maiorGasto = null

  for (const t of txs) {
    if (!isDespesa(t)) continue
    const v = Number(t.valor) || 0
    const data = new Date(`${String(t.data_transacao).slice(0, 10)}T12:00:00`)
    const nomeCat = t.categorias?.nome || 'Outros'
    if (data >= inicioMesAtual) {
      gastoAtual += v
      catAtual.set(nomeCat, (catAtual.get(nomeCat) || 0) + v)
      if (!maiorGasto || v > maiorGasto.valor) maiorGasto = { valor: v, descricao: t.descricao, categoria: nomeCat }
    } else {
      gastoPassadoTotal += v
      catPassado.set(nomeCat, (catPassado.get(nomeCat) || 0) + v)
      if (data <= fimMesPassadoMesmoDia) gastoPassadoMesmoPeriodo += v
    }
  }

  // 1) Comparação de gasto total (mesmo período do mês passado)
  const dTotal = pctDelta(gastoAtual, gastoPassadoMesmoPeriodo)
  if (gastoAtual > 0 && dTotal !== null && Math.abs(dTotal) >= 8) {
    insights.push({
      id: 'gasto-total',
      icone: dTotal > 0 ? '📈' : '📉',
      tom: dTotal > 0 ? 'alerta' : 'positivo',
      titulo: dTotal > 0 ? `Gastando ${dTotal}% a mais` : `Gastando ${Math.abs(dTotal)}% a menos`,
      texto: `Você já gastou ${brl(gastoAtual)} este mês — ${dTotal > 0 ? `${dTotal}% acima` : `${Math.abs(dTotal)}% abaixo`} do mesmo período do mês passado.`,
    })
  }

  // 2) Categoria em alta (maior aumento absoluto vs mês passado)
  let catUp = null
  for (const [nome, valAtual] of catAtual) {
    const valPassado = catPassado.get(nome) || 0
    const aumento = valAtual - valPassado
    const dPct = pctDelta(valAtual, valPassado)
    if (valPassado > 0 && dPct !== null && dPct >= 20 && aumento >= 50) {
      if (!catUp || aumento > catUp.aumento) catUp = { nome, valAtual, valPassado, dPct, aumento }
    }
  }
  if (catUp) {
    insights.push({
      id: 'categoria-alta',
      icone: '🔥',
      tom: 'alerta',
      titulo: `${catUp.nome} subiu ${catUp.dPct}%`,
      texto: `Seus gastos com ${catUp.nome} foram de ${brl(catUp.valPassado)} para ${brl(catUp.valAtual)} este mês.`,
    })
  }

  // 3) Projeção do mês (ritmo atual)
  if (gastoAtual > 0 && diaHoje >= 3) {
    const diasNoMes = new Date(y, m + 1, 0).getDate()
    const projecao = (gastoAtual / diaHoje) * diasNoMes
    insights.push({
      id: 'projecao',
      icone: '🎯',
      tom: 'neutro',
      titulo: 'Projeção do mês',
      texto: `No ritmo atual, você deve fechar o mês em cerca de ${brl(projecao)}.`,
    })
  }

  // 4) Maior categoria do mês
  if (catAtual.size > 0) {
    let top = null
    for (const [nome, val] of catAtual) if (!top || val > top.val) top = { nome, val }
    if (top && top.val > 0 && (gastoAtual === 0 || top.val / gastoAtual >= 0.18)) {
      insights.push({
        id: 'top-categoria',
        icone: '💸',
        tom: 'neutro',
        titulo: `Maior gasto: ${top.nome}`,
        texto: `${brl(top.val)} em ${top.nome} este mês${gastoAtual > 0 ? ` — ${Math.round((top.val / gastoAtual) * 100)}% do total.` : '.'}`,
      })
    }
  }

  // 5) Fatura de cartão fechando em breve
  try {
    const cartoes = await listarCartoesComResumo(usuarioId)
    for (const c of cartoes) {
      const venc = c.fatura_atual?.vencimento
      const total = Number(c.fatura_atual?.total) || 0
      if (!venc || total <= 0) continue
      const dv = new Date(`${venc}T12:00:00`)
      const dias = Math.round((dv - hoje) / 86400000)
      if (dias >= 0 && dias <= 7) {
        insights.push({
          id: `fatura-${c.id}`,
          icone: '💳',
          tom: dias <= 3 ? 'alerta' : 'neutro',
          titulo: `Fatura ${c.nome} vence ${dias === 0 ? 'hoje' : `em ${dias}d`}`,
          texto: `A fatura atual do ${c.nome} está em ${brl(total)}.`,
        })
      }
    }
  } catch (e) {
    log.warn('[insights] cartoes', e.message || e)
  }

  // 6) Meta mais avançada (motivação)
  try {
    const metas = await listarMetas(usuarioId)
    let melhor = null
    for (const meta of metas) {
      const alvo = Number(meta.valor_alvo) || 0
      const guardado = Number(meta.valor_guardado) || 0
      if (alvo <= 0 || meta.concluida_em) continue
      const pct = Math.round((guardado / alvo) * 100)
      if (pct >= 25 && (!melhor || pct > melhor.pct)) melhor = { meta, pct, falta: alvo - guardado }
    }
    if (melhor) {
      insights.push({
        id: `meta-${melhor.meta.id}`,
        icone: melhor.meta.icone || '🏆',
        tom: 'positivo',
        titulo: `Meta ${melhor.meta.nome}: ${melhor.pct}%`,
        texto: `Faltam ${brl(melhor.falta)} pra você bater a meta. Tá quase lá!`,
      })
    }
  } catch (e) {
    log.warn('[insights] metas', e.message || e)
  }

  // Ordena: alertas primeiro, depois positivos, depois neutros
  const ordemTom = { alerta: 0, positivo: 1, destaque: 1, neutro: 2 }
  insights.sort((a, b) => (ordemTom[a.tom] ?? 3) - (ordemTom[b.tom] ?? 3))

  return insights.slice(0, 6)
}

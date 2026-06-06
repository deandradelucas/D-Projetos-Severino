import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { log } from '../logger.mjs'
import { sendEvolutionText } from '../evolution-send.mjs'
import { partesBrt } from '../date-brt.mjs'

function fmt(v) {
  return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function mesAtualRange() {
  // Mês corrente em BRT (não UTC: nas últimas 3h do mês, o UTC já é o mês seguinte).
  const { ano, mes } = partesBrt() // mes 1-12
  const pad = (n) => String(n).padStart(2, '0')
  const proxAno = mes === 12 ? ano + 1 : ano
  const proxMes = mes === 12 ? 1 : mes + 1
  return {
    inicio: `${ano}-${pad(mes)}-01`,
    fimExclusivo: `${proxAno}-${pad(proxMes)}-01`,
  }
}

// ─── 2.1 Gasto acima do padrão ────────────────────────────────────────────────

async function calcularMediaCategoriaHistorica(usuarioId, categoriaId, transacaoIdExcluir) {
  const supabase = getSupabaseAdmin()
  const since = new Date()
  since.setUTCMonth(since.getUTCMonth() - 3)
  const sinceIso = since.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('transacoes')
    .select('id, valor')
    .eq('usuario_id', usuarioId)
    .eq('categoria_id', categoriaId)
    .eq('tipo', 'DESPESA')
    .eq('status', 'EFETIVADA')
    .gte('data_transacao', sinceIso)
    .order('data_transacao', { ascending: false })
    .limit(60)

  if (error || !data?.length) return null

  const valores = (data || [])
    .filter(t => t.id !== transacaoIdExcluir)
    .map(t => Number(t.valor) || 0)
    .filter(v => v > 0)

  if (valores.length < 5) return null
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

export async function verificarGastoAlto(usuarioId, categoriaId, valorAtual, transacaoId, nomeCategoria) {
  try {
    if (!categoriaId || !valorAtual || valorAtual <= 0) return
    const media = await calcularMediaCategoriaHistorica(usuarioId, categoriaId, transacaoId)
    if (!media || media <= 0) return
    if (valorAtual <= 2 * media) return

    const fator = (valorAtual / media).toFixed(1)
    const catLabel = nomeCategoria ? `*${nomeCategoria}*` : 'nessa categoria'
    return `⚠️ *Gasto fora do padrão detectado!*\n\nVocê gastou ${fmt(valorAtual)} em ${catLabel}, que é ${fator}x acima da sua média histórica (${fmt(media)}).\n\nTudo certo? 😊`
  } catch (e) {
    log.warn('[alertas] verificarGastoAlto error', e?.message)
  }
}

// ─── 2.2 Alerta de orçamento por categoria ────────────────────────────────────

export async function buscarLimiteOrcamento(usuarioId, categoriaId) {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('limites_orcamento')
    .select('limite_mensal')
    .eq('usuario_id', usuarioId)
    .eq('categoria_id', categoriaId)
    .maybeSingle()
  return data?.limite_mensal ? Number(data.limite_mensal) : null
}

export async function upsertLimiteOrcamento(usuarioId, categoriaId, limiteMensal) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('limites_orcamento')
    .upsert(
      { usuario_id: usuarioId, categoria_id: categoriaId, limite_mensal: limiteMensal, atualizado_em: new Date().toISOString() },
      { onConflict: 'usuario_id,categoria_id' }
    )
  if (error) throw error
}

export async function listarLimitesOrcamento(usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('limites_orcamento')
    .select('categoria_id, limite_mensal')
    .eq('usuario_id', usuarioId)
  if (error) throw error
  return data || []
}

async function somarDespesasMes(usuarioId, categoriaId) {
  const supabase = getSupabaseAdmin()
  const { inicio, fimExclusivo } = mesAtualRange()
  const { data, error } = await supabase
    .from('transacoes')
    .select('valor')
    .eq('usuario_id', usuarioId)
    .eq('categoria_id', categoriaId)
    .eq('tipo', 'DESPESA')
    .eq('status', 'EFETIVADA')
    .gte('data_transacao', inicio)
    .lt('data_transacao', fimExclusivo)

  if (error) return null
  return (data || []).reduce((acc, t) => acc + (Number(t.valor) || 0), 0)
}

export async function verificarLimiteOrcamento(usuarioId, categoriaId, valorAtual, nomeCategoria) {
  try {
    if (!categoriaId || !valorAtual || valorAtual <= 0) return
    const limite = await buscarLimiteOrcamento(usuarioId, categoriaId)
    if (!limite || limite <= 0) return

    const totalMes = await somarDespesasMes(usuarioId, categoriaId)
    if (totalMes === null) return

    const totalAntes = totalMes - valorAtual
    const pctAntes = (totalAntes / limite) * 100
    const pctDepois = (totalMes / limite) * 100
    const catLabel = nomeCategoria ? `*${nomeCategoria}*` : 'nessa categoria'

    if (pctAntes < 100 && pctDepois >= 100) {
      return `🚨 *Limite de orçamento atingido!*\n\nVocê atingiu 100% do seu limite mensal em ${catLabel}.\n\nLimite: ${fmt(limite)} | Gasto: ${fmt(totalMes)}`
    }
    if (pctAntes < 80 && pctDepois >= 80) {
      const restante = limite - totalMes
      return `⚠️ *80% do orçamento usado!*\n\nVocê usou ${pctDepois.toFixed(0)}% do limite mensal em ${catLabel}.\n\nRestam ${fmt(restante)} de ${fmt(limite)}.`
    }
  } catch (e) {
    log.warn('[alertas] verificarLimiteOrcamento error', e?.message)
  }
}

// ─── Dispatcher: envia alertas pós-transação ──────────────────────────────────

export async function dispararAlertasTransacao({ usuarioId, categoriaId, nomeCategoria, valorAtual, transacaoId, phone, instance }) {
  const alertas = await Promise.all([
    verificarGastoAlto(usuarioId, categoriaId, valorAtual, transacaoId, nomeCategoria),
    verificarLimiteOrcamento(usuarioId, categoriaId, valorAtual, nomeCategoria),
  ])

  for (const msg of alertas) {
    if (!msg) continue
    try {
      await sendEvolutionText({ instance, number: phone, text: msg })
    } catch (e) {
      log.warn('[alertas] falha ao enviar alerta WhatsApp', e?.message)
    }
  }
}

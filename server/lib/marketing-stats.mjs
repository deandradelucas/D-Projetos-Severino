import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import {
  resumoPagamentosPorUsuarioIds,
  STATUS_PAGAMENTO_LIBERA_ACESSO,
} from './pagamentos-asaas.mjs'

const STATUSES_APROVADOS = [...STATUS_PAGAMENTO_LIBERA_ACESSO]

/** Evita URL/query gigante no `.in('usuario_id', …)` do PostgREST. */
const USER_IDS_CHUNK = 250

/**
 * Agrega métricas de marketing para o desafio do primeiro milhão.
 * Fonte: `usuarios` (trial / isenção) + `pagamentos_asaas` (aprovados → assinante + receita).
 */
export async function getMarketingStatsAdmin() {
  const sb = getSupabaseAdmin()
  const nowMs = Date.now()

  const { data: users, error: usersErr } = await sb
    .from('usuarios')
    .select('id, isento_pagamento, trial_ends_at, created_at')

  if (usersErr) throw usersErr

  const userRows = users || []
  const ids = [...new Set(userRows.map((u) => String(u.id || '').trim()).filter(Boolean))]

  const approvedIds = new Set()
  for (let i = 0; i < ids.length; i += USER_IDS_CHUNK) {
    const slice = ids.slice(i, i + USER_IDS_CHUNK)
    try {
      const { approvedIds: chunkApproved } = await resumoPagamentosPorUsuarioIds(slice)
      for (const id of chunkApproved) {
        approvedIds.add(String(id))
      }
    } catch (e) {
      log.warn('[marketing-stats] resumoPagamentosPorUsuarioIds chunk failed', e?.message || e)
    }
  }

  let total = 0
  let assinantes = 0
  let isentos = 0
  let em_trial = 0
  let trial_expirado = 0
  let sem_trial = 0

  for (const u of userRows) {
    total++
    const uid = String(u.id || '')
    if (u.isento_pagamento) {
      isentos++
    } else if (uid && approvedIds.has(uid)) {
      assinantes++
    } else if (u.trial_ends_at) {
      const trialEnd = new Date(u.trial_ends_at).getTime()
      if (trialEnd > nowMs) {
        em_trial++
      } else {
        trial_expirado++
      }
    } else {
      sem_trial++
    }
  }

  let receita_total = 0
  let receita_mes_atual = 0

  try {
    const { data: pagamentos, error: pagErr } = await sb
      .from('pagamentos_asaas')
      .select('amount, status, created_at')
      .in('status', STATUSES_APROVADOS)

    if (pagErr) {
      log.warn('[marketing-stats] pagamentos select failed', pagErr.message || pagErr)
    } else if (pagamentos) {
      const startOfMonth = new Date()
      startOfMonth.setUTCDate(1)
      startOfMonth.setUTCHours(0, 0, 0, 0)
      const monthStr = startOfMonth.toISOString()

      for (const p of pagamentos) {
        const st = String(p.status || '').toLowerCase()
        if (!STATUS_PAGAMENTO_LIBERA_ACESSO.has(st)) continue
        const amt = Number(p.amount) || 0
        receita_total += amt
        if (p.created_at >= monthStr) receita_mes_atual += amt
      }
    }
  } catch (e) {
    log.warn('[marketing-stats] receita pagamentos', e?.message || e)
  }

  const planPriceRaw = parseFloat(process.env.HORIZONTE_PLANO_PRECO || '19.90')
  const planPrice = Number.isFinite(planPriceRaw) && planPriceRaw > 0 ? planPriceRaw : 19.9
  const mrr = assinantes * planPrice
  const total_qualified = assinantes + trial_expirado
  const conversion_rate = total_qualified > 0 ? assinantes / total_qualified : 0

  const META = 1_000_000

  return {
    total_usuarios: total,
    assinantes_ativos: assinantes,
    isentos,
    em_trial,
    trial_expirado,
    sem_trial,
    mrr,
    plan_price: planPrice,
    receita_total,
    receita_mes_atual,
    conversion_rate,
    meta_milhao: META,
    progresso_percent: Math.min(100, (receita_total / META) * 100),
    faltam: Math.max(0, META - receita_total),
    assinantes_para_meta_mrr: Math.ceil(META / 12 / planPrice),
  }
}

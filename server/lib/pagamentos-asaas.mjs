import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import {
  buscarAssinaturaAsaas,
  buscarCobrancaAsaas,
  isAsaasConfigured,
  isAsaasForbiddenError,
  parseUsuarioIdFromExternalReference,
} from './asaas.mjs'

function getStartOfCurrentMonthMs() {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}

const asaas403DebugLast = new Map()
const ASAAS403_DEBUG_MIN_INTERVAL_MS = 5 * 60 * 1000

function logAsaasSyncIssue(contexto, idRef, err) {
  if (isAsaasForbiddenError(err)) {
    const key = `${contexto}:${String(idRef)}`
    const now = Date.now()
    const last = asaas403DebugLast.get(key) ?? 0
    if (now - last < ASAAS403_DEBUG_MIN_INTERVAL_MS) return
    asaas403DebugLast.set(key, now)
    if (asaas403DebugLast.size > 2000) asaas403DebugLast.clear()
    log.debug(contexto, idRef, 'Asaas 401/403 — confira ASAAS_API_KEY e ambiente (sandbox vs produção).')
    return
  }
  log.warn(contexto, idRef, err?.message || err)
}

export async function insertCheckoutRecord({
  usuario_id,
  checkout_id,
  external_reference,
  amount,
  description,
}) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('pagamentos_asaas')
    .insert({
      usuario_id,
      checkout_id: checkout_id ? String(checkout_id) : null,
      external_reference,
      amount,
      description,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function atualizarUsuarioDeSubscriptionResponse(usuarioId, sub) {
  const uid = String(usuarioId || '').trim()
  if (!uid || !sub?.id) return
  const supabase = getSupabaseAdmin()
  const st = String(sub.status || '').toUpperCase() || null
  let nextIso = null
  if (sub.nextDueDate) {
    const raw = String(sub.nextDueDate).trim()
    const d = raw.includes('T') ? new Date(raw) : new Date(`${raw}T12:00:00.000Z`)
    if (!Number.isNaN(d.getTime())) nextIso = d.toISOString()
  }
  const customerId = sub.customer != null ? String(sub.customer).trim() : null
  const patch = {
    asaas_subscription_id: String(sub.id),
    assinatura_asaas_status: st,
    assinatura_proxima_cobranca: nextIso,
  }
  if (customerId) patch.asaas_customer_id = customerId

  const { error } = await supabase.from('usuarios').update(patch).eq('id', uid)
  if (error) log.warn('[atualizarUsuarioDeSubscriptionResponse]', error.message || error)
}

export async function sincronizarSubscriptionUsuario(usuario_id) {
  const uid = String(usuario_id || '').trim()
  if (!uid || !isAsaasConfigured()) return

  const supabase = getSupabaseAdmin()
  const { data: row, error } = await supabase.from('usuarios').select('asaas_subscription_id').eq('id', uid).maybeSingle()

  if (error || !row?.asaas_subscription_id) return

  try {
    const sub = await buscarAssinaturaAsaas(row.asaas_subscription_id)
    await atualizarUsuarioDeSubscriptionResponse(uid, sub)
  } catch (e) {
    logAsaasSyncIssue('[sincronizarSubscriptionUsuario]', row.asaas_subscription_id, e)
  }
}

export async function sincronizarSubscriptionPorIdFromWebhook(subscriptionId) {
  const id = String(subscriptionId || '').trim()
  if (!id || !isAsaasConfigured()) return

  try {
    const sub = await buscarAssinaturaAsaas(id)
    const supabase = getSupabaseAdmin()
    let uid = parseUsuarioIdFromExternalReference(sub.externalReference)
    if (!uid) {
      const { data } = await supabase.from('usuarios').select('id').eq('asaas_subscription_id', id).maybeSingle()
      uid = data?.id || null
    }
    if (uid) await atualizarUsuarioDeSubscriptionResponse(uid, sub)
  } catch (e) {
    logAsaasSyncIssue('[sincronizarSubscriptionPorIdFromWebhook]', id, e)
  }
}

export async function upsertFromWebhookAsaasPayment(payment) {
  if (!payment?.id) return

  const supabase = getSupabaseAdmin()
  const pid = String(payment.id)
  const st = String(payment.status || '').toLowerCase()
  const extRef = payment.externalReference != null ? String(payment.externalReference).trim() : ''
  const uidFromRef = parseUsuarioIdFromExternalReference(extRef)
  const subId = payment.subscription != null ? String(payment.subscription).trim() : ''

  const payload = {
    payment_id: pid,
    status: st,
    status_detail: payment.billingType != null ? String(payment.billingType) : null,
    amount: payment.value != null ? Number(payment.value) : null,
    currency_id: 'BRL',
    description: payment.description || null,
    payer_email: null,
    raw_payload: payment,
    updated_at: new Date().toISOString(),
  }

  const { data: byPay } = await supabase
    .from('pagamentos_asaas')
    .select('id, usuario_id')
    .eq('payment_id', pid)
    .maybeSingle()

  if (byPay) {
    const { error } = await supabase
      .from('pagamentos_asaas')
      .update({
        ...payload,
        ...(subId ? { subscription_id: subId } : {}),
      })
      .eq('id', byPay.id)
    if (error) log.warn('[upsertFromWebhookAsaasPayment] update', error.message || error)
    if (byPay.usuario_id) void sincronizarSubscriptionUsuario(String(byPay.usuario_id)).catch(() => {})
    return
  }

  if (extRef) {
    const { data: row } = await supabase
      .from('pagamentos_asaas')
      .select('id, usuario_id')
      .eq('external_reference', extRef)
      .maybeSingle()

    if (row) {
      const { error } = await supabase
        .from('pagamentos_asaas')
        .update({
          ...payload,
          payment_id: pid,
          ...(subId ? { subscription_id: subId } : {}),
        })
        .eq('id', row.id)
      if (error) log.warn('[upsertFromWebhookAsaasPayment] update ref', error.message || error)
      if (row.usuario_id) void sincronizarSubscriptionUsuario(String(row.usuario_id)).catch(() => {})
      return
    }
  }

  let usuarioId = uidFromRef
  if (!usuarioId && subId) {
    const { data: urow } = await supabase.from('usuarios').select('id').eq('asaas_subscription_id', subId).maybeSingle()
    usuarioId = urow?.id || null
  }

  const { error: insErr } = await supabase.from('pagamentos_asaas').insert({
    usuario_id: usuarioId,
    checkout_id: null,
    subscription_id: subId || null,
    payment_id: pid,
    external_reference: extRef || null,
    description: payload.description,
    status: st,
    status_detail: payload.status_detail,
    amount: payload.amount,
    currency_id: 'BRL',
    payer_email: payload.payer_email,
    raw_payload: payment,
  })
  if (insErr) log.warn('[upsertFromWebhookAsaasPayment] insert', insErr.message || insErr)

  if (usuarioId) void sincronizarSubscriptionUsuario(String(usuarioId)).catch(() => {})
}

export const STATUS_PAGAMENTO_LIBERA_ACESSO = new Set(['received', 'confirmed'])

const STATUS_FINAL_RUIM = new Set(['refunded', 'charged_back'])

function precisaSincronizarStatus(status) {
  const s = String(status || '').toLowerCase()
  if (STATUS_PAGAMENTO_LIBERA_ACESSO.has(s) || STATUS_FINAL_RUIM.has(s)) return false
  return true
}

export async function sincronizarPagamentosPendentesDoUsuario(usuario_id) {
  const uid = String(usuario_id || '').trim()
  if (!uid || !isAsaasConfigured()) return

  const supabase = getSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('pagamentos_asaas')
    .select('id, checkout_id, payment_id, external_reference, status')
    .eq('usuario_id', uid)
    .order('created_at', { ascending: false })
    .limit(25)

  if (error || !rows?.length) return

  for (const row of rows) {
    if (!precisaSincronizarStatus(row.status)) continue
    try {
      if (row.payment_id) {
        const pay = await buscarCobrancaAsaas(String(row.payment_id))
        await upsertFromWebhookAsaasPayment(pay)
        continue
      }
    } catch (e) {
      logAsaasSyncIssue('[sincronizarPagamentosPendentesDoUsuario]', row.external_reference || row.id, e)
    }
  }
}

export async function listPagamentosUsuario(usuario_id, limit = 20) {
  const uid = String(usuario_id || '').trim()
  if (!uid) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('pagamentos_asaas')
    .select(
      'id, checkout_id, subscription_id, payment_id, status, status_detail, amount, currency_id, description, external_reference, payer_email, created_at, updated_at'
    )
    .eq('usuario_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    log.warn('[listPagamentosUsuario]', error.message || error)
    return []
  }
  return (data || []).map((r) => ({
    ...r,
    preference_id: r.checkout_id,
    preapproval_id: r.subscription_id,
  }))
}

function linhaPagamentoAprovada(row) {
  return STATUS_PAGAMENTO_LIBERA_ACESSO.has(String(row?.status || '').toLowerCase())
}

export async function usuarioTemPagamentoAprovado(usuario_id, payerEmail = null) {
  const uid = String(usuario_id || '').trim()
  if (!uid) return false

  const supabase = getSupabaseAdmin()

  try {
    const { data, error } = await supabase.from('pagamentos_asaas').select('id, status').eq('usuario_id', uid).limit(50)

    if (error) {
      log.warn('[usuarioTemPagamentoAprovado] por usuario_id:', error.message || error)
    } else if ((data || []).some(linhaPagamentoAprovada)) {
      return true
    }

    const em = String(payerEmail || '').trim().toLowerCase()
    if (!em) return false

    const r2 = await supabase.from('pagamentos_asaas').select('id, status, usuario_id, payer_email').ilike('payer_email', em).limit(80)

    if (r2.error) {
      log.warn('[usuarioTemPagamentoAprovado] por payer_email:', r2.error.message || r2.error)
      return false
    }

    const candidatos = (r2.data || []).filter(
      (row) => linhaPagamentoAprovada(row) && (!row.usuario_id || String(row.usuario_id).trim() === uid)
    )
    if (candidatos.length === 0) {
      /* Diagnóstico fuzzy (rule data-lookup-safety): "não encontrado" pode ser typo
       * no e-mail do pagador. NÃO concede acesso por similaridade (risco de liberar
       * com pagamento de outra pessoa) — só loga para reconciliação manual. */
      try {
        const localpart = em.split('@')[0]
        if (localpart.length >= 5) {
          const esc = localpart.replace(/[%_\\]/g, (ch) => `\\${ch}`)
          const fz = await supabase
            .from('pagamentos_asaas')
            .select('id, status, payer_email')
            .ilike('payer_email', `%${esc}%`)
            .neq('payer_email', em)
            .limit(5)
          const similares = (fz.data || []).filter(linhaPagamentoAprovada)
          if (similares.length > 0) {
            log.warn('[usuarioTemPagamentoAprovado] possível typo no payer_email — pagamento aprovado com e-mail SIMILAR encontrado; reconciliar manualmente', {
              usuarioId: uid,
              emailBuscado: em,
              similares: similares.map((r) => ({ id: r.id, payer_email: r.payer_email })),
            })
          }
        }
      } catch { /* diagnóstico nunca derruba o fluxo */ }
      return false
    }

    const semVinculo = candidatos.find((row) => !row.usuario_id && row.id)
    if (semVinculo) {
      const { error: upErr } = await supabase.from('pagamentos_asaas').update({ usuario_id: uid }).eq('id', semVinculo.id)
      if (upErr) log.warn('[usuarioTemPagamentoAprovado] vincular usuario_id:', upErr.message || upErr)
    }
    return true
  } catch (e) {
    log.warn('[usuarioTemPagamentoAprovado]', e?.message || e)
    return false
  }
}

export async function resumoPagamentosPorUsuarioIds(userIds) {
  const latestByUser = new Map()
  const approvedIds = new Set()
  const ids = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return { latestByUser, approvedIds }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('pagamentos_asaas')
    .select('usuario_id, status, amount, updated_at, created_at, status_detail')
    .in('usuario_id', ids)

  if (error) throw error
  const rows = data || []
  for (const r of rows) {
    const u = r.usuario_id
    if (!u) continue
    if (STATUS_PAGAMENTO_LIBERA_ACESSO.has(String(r.status || '').toLowerCase())) approvedIds.add(u)
  }
  rows.sort((a, b) => {
    const tb = new Date(b.updated_at || b.created_at || 0).getTime()
    const ta = new Date(a.updated_at || a.created_at || 0).getTime()
    return tb - ta
  })
  for (const r of rows) {
    const u = r.usuario_id
    if (u && !latestByUser.has(u)) latestByUser.set(u, r)
  }
  return { latestByUser, approvedIds }
}

export async function aggregatePagamentosFinanceirosPorUsuarioIds(userIds) {
  const map = new Map()
  const ids = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return map

  const startMs = getStartOfCurrentMonthMs()

  const supabase = getSupabaseAdmin()
  let from = 0
  const pageSize = 1000

  for (;;) {
    const { data, error } = await supabase
      .from('pagamentos_asaas')
      .select('usuario_id, status, amount, created_at, updated_at')
      .in('usuario_id', ids)
      .range(from, from + pageSize - 1)

    if (error) throw error
    const rows = data || []
    for (const r of rows) {
      const uid = String(r.usuario_id || '')
      if (!uid || !STATUS_PAGAMENTO_LIBERA_ACESSO.has(String(r.status || '').toLowerCase())) continue
      const amt = Number(r.amount) || 0
      const prev = map.get(uid) || {
        accumulatedRevenue: 0,
        monthlyRevenue: 0,
        lastPaymentDate: null,
      }
      prev.accumulatedRevenue += amt
      const ca = r.created_at ? new Date(r.created_at).getTime() : 0
      if (ca >= startMs) prev.monthlyRevenue += amt
      const tStr = r.updated_at || r.created_at
      const t = tStr ? new Date(tStr).getTime() : 0
      if (tStr && (!prev.lastPaymentDate || t > new Date(prev.lastPaymentDate).getTime())) {
        prev.lastPaymentDate = tStr
      }
      map.set(uid, prev)
    }
    if (rows.length < pageSize) break
    from += pageSize
  }

  for (const [uid, v] of map.entries()) {
    map.set(uid, {
      accumulatedRevenue: Math.round(v.accumulatedRevenue * 100) / 100,
      monthlyRevenue: Math.round(v.monthlyRevenue * 100) / 100,
      lastPaymentDate: v.lastPaymentDate,
    })
  }
  return map
}

export async function agregarPagamentosAprovadosGlobais() {
  const supabase = getSupabaseAdmin()
  const startMs = getStartOfCurrentMonthMs()

  let accumulatedRevenue = 0
  let monthlyRevenue = 0
  const paidUserIds = new Set()
  const stList = [...STATUS_PAGAMENTO_LIBERA_ACESSO]

  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('pagamentos_asaas')
      .select('usuario_id, amount, created_at')
      .in('status', stList)
      .range(from, from + pageSize - 1)

    if (error) throw error
    const rows = data || []
    for (const r of rows) {
      const amt = Number(r.amount) || 0
      accumulatedRevenue += amt
      const ca = r.created_at ? new Date(r.created_at).getTime() : 0
      if (ca >= startMs) monthlyRevenue += amt
      if (r.usuario_id) paidUserIds.add(String(r.usuario_id))
    }
    if (rows.length < pageSize) break
    from += pageSize
  }

  const n = paidUserIds.size
  return {
    accumulatedRevenue: Math.round(accumulatedRevenue * 100) / 100,
    monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
    paidSubscriptions: n,
    ticketMedioUsuario: n > 0 ? Math.round((accumulatedRevenue / n) * 100) / 100 : 0,
  }
}

export async function fetchUsuarioIdsComPagamentoAprovado() {
  const supabase = getSupabaseAdmin()
  const set = new Set()
  const stList = [...STATUS_PAGAMENTO_LIBERA_ACESSO]
  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('pagamentos_asaas')
      .select('usuario_id')
      .in('status', stList)
      .not('usuario_id', 'is', null)
      .range(from, from + pageSize - 1)

    if (error) throw error
    const rows = data || []
    for (const r of rows) {
      if (r.usuario_id) set.add(String(r.usuario_id))
    }
    if (rows.length < pageSize) break
    from += pageSize
  }
  return set
}

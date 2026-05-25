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
    if (candidatos.length === 0) return false

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

const COLS_FLAT = `
  id,
  usuario_id,
  checkout_id,
  subscription_id,
  payment_id,
  status,
  status_detail,
  amount,
  currency_id,
  description,
  external_reference,
  payer_email,
  created_at,
  updated_at
`

const COLS_ADMIN_EXTRA = `, raw_payload`

const USUARIOS_EMBED_ADMIN =
  'usuarios ( email, nome, isento_pagamento, assinatura_proxima_cobranca, assinatura_asaas_status )'
const USUARIOS_EMBED_ADMIN_LEGACY =
  'usuarios ( email, usuario, isento_pagamento, assinatura_proxima_cobranca, assinatura_asaas_status )'

const STATUS_GRUPO_PENDENTE = ['pending', 'overdue', 'authorized', 'awaiting_risk_analysis']
const STATUS_GRUPO_RECUSADO = ['refunded', 'charged_back']
const STATUS_GRUPO_ESTORNADO = ['refunded']

export function computePaymentAdminSummary(rows, meta = {}) {
  const list = Array.isArray(rows) ? rows : []
  const now = Date.now()
  const startMs = getStartOfCurrentMonthMs()

  let accumulatedRevenue = 0
  let approvedCount = 0
  let pendingCount = 0
  let rejectedCount = 0
  let refundedCount = 0
  let exemptUserIds = new Set()
  let pendingAmount = 0
  let monthlyRevenue = 0
  let overdueCount = 0

  const nextDates = []

  for (const r of list) {
    const st = String(r.status || '').toLowerCase()
    const amt = Number(r.amount) || 0
    const u = r.usuarios
    if (u && typeof u === 'object' && u.isento_pagamento === true && r.usuario_id) {
      exemptUserIds.add(String(r.usuario_id))
    }
    if (u && typeof u === 'object' && u.assinatura_proxima_cobranca) {
      const t = new Date(u.assinatura_proxima_cobranca).getTime()
      if (!Number.isNaN(t) && t > now) nextDates.push(t)
    }

    if (STATUS_PAGAMENTO_LIBERA_ACESSO.has(st)) {
      approvedCount += 1
      accumulatedRevenue += amt
      const ca = r.created_at ? new Date(r.created_at).getTime() : 0
      if (ca >= startMs) monthlyRevenue += amt
    } else if (st === 'refunded') {
      refundedCount += 1
    } else if (st === 'charged_back') {
      rejectedCount += 1
    } else if (STATUS_GRUPO_PENDENTE.includes(st)) {
      pendingCount += 1
      pendingAmount += amt
      const ca = r.created_at ? new Date(r.created_at).getTime() : now
      if (now - ca > 7 * 24 * 60 * 60 * 1000 || st === 'overdue') overdueCount += 1
    }
  }

  const denom = approvedCount + rejectedCount
  const approvalRate = denom > 0 ? Math.round((approvedCount / denom) * 1000) / 10 : null

  nextDates.sort((a, b) => a - b)
  const nextPaymentDate = nextDates.length ? new Date(nextDates[0]).toISOString() : null

  return {
    totalRecords: list.length,
    accumulatedRevenue: Math.round(accumulatedRevenue * 100) / 100,
    approvedCount,
    pendingCount,
    rejectedCount,
    refundedCount,
    overdueCount,
    exemptCount: exemptUserIds.size,
    pendingAmount: Math.round(pendingAmount * 100) / 100,
    nextPaymentDate,
    nextDueDate: nextPaymentDate,
    monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
    approvalRate,
    summaryTruncated: meta.truncated === true,
    ticketMedio: approvedCount > 0 ? Math.round((accumulatedRevenue / approvedCount) * 100) / 100 : 0,
  }
}

export function enrichPaymentLogAdminRow(row) {
  const raw = row.raw_payload && typeof row.raw_payload === 'object' ? row.raw_payload : {}
  const u = row.usuarios && typeof row.usuarios === 'object' ? row.usuarios : {}
  const st = String(row.status || '').toLowerCase()
  const createdMs = row.created_at ? new Date(row.created_at).getTime() : 0
  const pendingOld = STATUS_GRUPO_PENDENTE.includes(st) && Date.now() - createdMs > 7 * 24 * 60 * 60 * 1000

  return {
    ...row,
    dueDate: raw.dueDate || raw.originalDueDate || null,
    paymentMethod: raw.billingType != null ? String(raw.billingType) : null,
    provider: 'asaas',
    billingCycle: raw.subscriptionCycle || null,
    lastPaymentDate: row.updated_at || row.created_at || null,
    failureReason: row.status_detail || null,
    attemptCount: null,
    subscriptionStatus: u.assinatura_asaas_status || null,
    nextPaymentDate: u.assinatura_proxima_cobranca || null,
    isExempt: u.isento_pagamento === true,
    exemptionType: null,
    isOverdue: pendingOld,
    userName: u.nome || u.usuario || '',
    userEmail: u.email || row.payer_email || '',
    notes: row.description || null,
  }
}

function buildAdminPagamentosQuery(supabase, usuariosEmbed, { statusGroup, dateFrom, dateTo, sort }) {
  let query = supabase.from('pagamentos_asaas').select(`${COLS_FLAT.trim()}${COLS_ADMIN_EXTRA}, ${usuariosEmbed}`)

  if (sort === 'amount_desc' || sort === 'amount_asc') {
    query = query.order('amount', { ascending: sort === 'amount_asc' })
  } else {
    query = query.order('created_at', { ascending: sort === 'created_asc' })
  }

  if (statusGroup === 'approved') {
    query = query.in('status', [...STATUS_PAGAMENTO_LIBERA_ACESSO])
  } else if (statusGroup === 'pending') {
    query = query.in('status', STATUS_GRUPO_PENDENTE)
  } else if (statusGroup === 'rejected') {
    query = query.in('status', ['charged_back'])
  } else if (statusGroup === 'refunded') {
    query = query.in('status', STATUS_GRUPO_ESTORNADO)
  }

  if (dateFrom) {
    query = query.gte('created_at', dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`)
  }
  if (dateTo) {
    query = query.lte('created_at', dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`)
  }

  return query
}

export async function listPagamentosAdminPayload(opts = {}) {
  const limit = Math.min(800, Math.max(1, parseInt(String(opts.limit || 500), 10) || 500))
  const statusGroup = String(opts.statusGroup || 'all').toLowerCase()
  const q = String(opts.q || '')
    .trim()
    .toLowerCase()
  const dateFrom = opts.dateFrom ? String(opts.dateFrom).trim() : ''
  const dateTo = opts.dateTo ? String(opts.dateTo).trim() : ''
  const sort = String(opts.sort || 'created_desc')
  const exempt = String(opts.exempt || 'all').toLowerCase()
  const overdueOnly = opts.overdueOnly === true || opts.overdueOnly === '1' || opts.overdueOnly === 'true'

  const supabase = getSupabaseAdmin()
  const fetchLimit = Math.min(2500, limit * 4)

  const filterCtx = { statusGroup, dateFrom, dateTo, sort }
  let query = buildAdminPagamentosQuery(supabase, USUARIOS_EMBED_ADMIN, filterCtx)
  let res = await query.limit(fetchLimit)

  if (res.error) {
    query = buildAdminPagamentosQuery(supabase, USUARIOS_EMBED_ADMIN_LEGACY, filterCtx)
    res = await query.limit(fetchLimit)
  }

  if (res.error) throw res.error

  let rows = (res.data || []).map((row) => {
    const u = row.usuarios
    if (!u || typeof u !== 'object') return row
    return {
      ...row,
      usuarios: {
        email: u.email,
        nome: u.nome ?? u.usuario ?? '',
        isento_pagamento: u.isento_pagamento === true,
        assinatura_proxima_cobranca: u.assinatura_proxima_cobranca ?? null,
        assinatura_asaas_status: u.assinatura_asaas_status ?? null,
      },
    }
  })

  const missingUserIds = Array.from(
    new Set(
      rows
        .filter((row) => {
          if (!row || !row.usuario_id) return false
          const u = row.usuarios
          if (!u || typeof u !== 'object') return true
          return !u.email && !u.nome
        })
        .map((row) => String(row.usuario_id))
    )
  )

  if (missingUserIds.length > 0) {
    const { data: usersRows, error: usersErr } = await supabase
      .from('usuarios')
      .select('id, email, nome, usuario, isento_pagamento, assinatura_proxima_cobranca, assinatura_asaas_status')
      .in('id', missingUserIds)

    if (!usersErr && Array.isArray(usersRows) && usersRows.length > 0) {
      const usersById = new Map(usersRows.map((u) => [String(u.id), u]))
      rows = rows.map((row) => {
        if (!row || !row.usuario_id) return row
        const user = usersById.get(String(row.usuario_id))
        if (!user) return row
        const prev = row.usuarios && typeof row.usuarios === 'object' ? row.usuarios : {}
        return {
          ...row,
          usuarios: {
            email: prev.email || user.email || '',
            nome: prev.nome || user.nome || user.usuario || '',
            isento_pagamento: prev.isento_pagamento === true || user.isento_pagamento === true,
            assinatura_proxima_cobranca: prev.assinatura_proxima_cobranca || user.assinatura_proxima_cobranca || null,
            assinatura_asaas_status: prev.assinatura_asaas_status || user.assinatura_asaas_status || null,
          },
        }
      })
    }
  }

  if (q) {
    rows = rows.filter((row) => {
      const u = row.usuarios || {}
      const idStr = row.usuario_id ? String(row.usuario_id).toLowerCase() : ''
      const email = (u.email || '').toLowerCase()
      const nome = (u.nome || '').toLowerCase()
      const payer = (row.payer_email || '').toLowerCase()
      const cid = (row.checkout_id || '').toLowerCase()
      const payId = (row.payment_id || '').toLowerCase()
      const ext = (row.external_reference || '').toLowerCase()
      return (
        idStr.includes(q) ||
        email.includes(q) ||
        nome.includes(q) ||
        payer.includes(q) ||
        cid.includes(q) ||
        payId.includes(q) ||
        ext.includes(q)
      )
    })
  }

  if (exempt === 'yes') {
    rows = rows.filter((row) => row.usuarios && row.usuarios.isento_pagamento === true)
  } else if (exempt === 'no') {
    rows = rows.filter((row) => !row.usuarios || row.usuarios.isento_pagamento !== true)
  }

  if (overdueOnly) {
    const now = Date.now()
    rows = rows.filter((row) => {
      const st = String(row.status || '').toLowerCase()
      if (!STATUS_GRUPO_PENDENTE.includes(st)) return false
      const ca = row.created_at ? new Date(row.created_at).getTime() : now
      return now - ca > 7 * 24 * 60 * 60 * 1000
    })
  }

  const truncated = rows.length > limit
  const summary = computePaymentAdminSummary(rows, { truncated })
  rows = rows.slice(0, limit)

  const enriched = rows.map((r) => enrichPaymentLogAdminRow(r))

  return {
    rows: enriched,
    summary,
  }
}

export async function listPagamentosAdmin(limit = 200) {
  const { rows } = await listPagamentosAdminPayload({ limit, statusGroup: 'all' })
  return rows
}

export async function deletePagamentosPendentesAdmin() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('pagamentos_asaas').delete().in('status', STATUS_GRUPO_PENDENTE).select('id')

  if (error) throw error
  const deleted = Array.isArray(data) ? data.length : 0
  return { deleted }
}

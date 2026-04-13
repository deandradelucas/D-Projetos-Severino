import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import {
  buscarPagamentoPorId,
  buscarPagamentosPorExternalReference,
  buscarPreapprovalPorId,
  isMercadoPagoConfigured,
  isMercadoPagoForbiddenError,
} from './mercadopago.mjs'

/** Evita repetir [debug] 403 a cada request/sync para o mesmo id (vários usuários ou polling). */
const mp403DebugLast = new Map()
const MP403_DEBUG_MIN_INTERVAL_MS = 5 * 60 * 1000

/** 403: token TEST vs produção, outra conta MP, ou recurso de outro vendedor — não poluir logs com [warn]. */
function logMercadoPagoSyncIssue(contexto, idRef, err) {
  if (isMercadoPagoForbiddenError(err)) {
    const key = `${contexto}:${String(idRef)}`
    const now = Date.now()
    const last = mp403DebugLast.get(key) ?? 0
    if (now - last < MP403_DEBUG_MIN_INTERVAL_MS) return
    mp403DebugLast.set(key, now)
    if (mp403DebugLast.size > 2000) mp403DebugLast.clear()
    log.debug(
      contexto,
      idRef,
      'MP 403 Forbidden — use MERCADO_PAGO_ACCESS_TOKEN da mesma conta/ambiente dos pagamentos no banco.'
    )
    return
  }
  log.warn(contexto, idRef, err?.message || err)
}

export async function insertPreferenciaRecord({
  usuario_id,
  preference_id = null,
  preapproval_id = null,
  external_reference,
  amount,
  description,
}) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('pagamentos_mercadopago')
    .insert({
      usuario_id,
      preference_id,
      preapproval_id,
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

/** Mesmo dia no mês calendário seguinte (UTC); clamp ao último dia do mês (ex.: 31 jan → 28/29 fev). */
export function shiftToFollowingCalendarMonth(d) {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  const h = d.getUTCHours()
  const mi = d.getUTCMinutes()
  const s = d.getUTCSeconds()
  const ms = d.getUTCMilliseconds()
  const nm = m + 1
  const lastDom = new Date(Date.UTC(y, nm + 1, 0)).getUTCDate()
  const dom = Math.min(day, lastDom)
  return new Date(Date.UTC(y, nm, dom, h, mi, s, ms))
}

/** Garante data estritamente futura, avançando mês a mês (teto 24 iterações). */
export function ensureFutureMonthlyAnchor(d, now) {
  let out = new Date(d.getTime())
  let guard = 0
  while (out.getTime() <= now.getTime() && guard < 24) {
    out = shiftToFollowingCalendarMonth(out)
    guard += 1
  }
  return out
}

/**
 * Próxima cobrança exibida/armazenada: após a compra, no mês seguinte (não no mesmo mês),
 * enquanto o MP ainda não registrou cobrança recorrente (charged_quantity === 0).
 */
export function normalizarProximaCobrancaMensal(pre, nextIso) {
  if (!nextIso) return null
  const next = new Date(nextIso)
  if (Number.isNaN(next.getTime())) return null
  const now = new Date()
  const charged = Number(pre?.summarized?.charged_quantity ?? 0)
  if (charged > 0) {
    if (next.getTime() <= now.getTime()) return ensureFutureMonthlyAnchor(next, now).toISOString()
    return next.toISOString()
  }
  const sameMonth =
    next.getUTCFullYear() === now.getUTCFullYear() && next.getUTCMonth() === now.getUTCMonth()
  let out = sameMonth ? shiftToFollowingCalendarMonth(next) : next
  if (out.getTime() <= now.getTime()) out = ensureFutureMonthlyAnchor(out, now)
  return out.toISOString()
}

/**
 * Atualiza usuário com dados do preapproval (próxima cobrança, status).
 */
export async function atualizarUsuarioDePreapprovalResponse(usuarioId, pre) {
  const uid = String(usuarioId || '').trim()
  if (!uid || !pre?.id) return
  const supabase = getSupabaseAdmin()
  let nextIso = null
  if (pre.next_payment_date) {
    const d = new Date(pre.next_payment_date)
    if (!Number.isNaN(d.getTime())) nextIso = normalizarProximaCobrancaMensal(pre, d.toISOString())
  }
  const st = String(pre.status || '').toLowerCase() || null
  const { error } = await supabase
    .from('usuarios')
    .update({
      mp_preapproval_id: String(pre.id),
      assinatura_mp_status: st,
      assinatura_proxima_cobranca: nextIso,
    })
    .eq('id', uid)

  if (error) log.warn('[atualizarUsuarioDePreapprovalResponse]', error.message || error)
}

export async function sincronizarPreapprovalUsuario(usuario_id) {
  const uid = String(usuario_id || '').trim()
  if (!uid || !isMercadoPagoConfigured()) return

  const supabase = getSupabaseAdmin()
  const { data: row, error } = await supabase
    .from('usuarios')
    .select('mp_preapproval_id')
    .eq('id', uid)
    .maybeSingle()

  if (error || !row?.mp_preapproval_id) return

  try {
    const pre = await buscarPreapprovalPorId(row.mp_preapproval_id)
    await atualizarUsuarioDePreapprovalResponse(uid, pre)
  } catch (e) {
    logMercadoPagoSyncIssue('[sincronizarPreapprovalUsuario]', row.mp_preapproval_id, e)
  }
}

/** Webhook topic preapproval: atualiza próxima cobrança no usuário. */
export async function sincronizarPreapprovalPorIdFromWebhook(preapprovalId) {
  const id = String(preapprovalId || '').trim()
  if (!id || !isMercadoPagoConfigured()) return

  try {
    const pre = await buscarPreapprovalPorId(id)
    const supabase = getSupabaseAdmin()
    let uid =
      pre.metadata?.usuario_id ||
      pre.metadata?.usuarioId ||
      null
    if (!uid) {
      const { data } = await supabase.from('usuarios').select('id').eq('mp_preapproval_id', id).maybeSingle()
      uid = data?.id || null
    }
    if (uid) await atualizarUsuarioDePreapprovalResponse(uid, pre)
  } catch (e) {
    logMercadoPagoSyncIssue('[sincronizarPreapprovalPorIdFromWebhook]', id, e)
  }
}

/**
 * Atualiza registro criado na preferência/preapproval ou insere se o webhook chegar primeiro.
 */
export async function upsertFromWebhookPayment(payment) {
  if (payment?.id == null) return

  const supabase = getSupabaseAdmin()
  const pid = String(payment.id)

  const payload = {
    payment_id: pid,
    status: payment.status,
    status_detail: payment.status_detail || null,
    amount: payment.transaction_amount,
    currency_id: payment.currency_id || 'BRL',
    payer_email: payment.payer?.email || null,
    raw_payment: payment,
    updated_at: new Date().toISOString(),
  }

  const { data: byPayment } = await supabase
    .from('pagamentos_mercadopago')
    .select('id, usuario_id')
    .eq('payment_id', pid)
    .maybeSingle()

  if (byPayment?.id) {
    const { error } = await supabase.from('pagamentos_mercadopago').update(payload).eq('id', byPayment.id)
    if (error) throw error
    if (byPayment.usuario_id) void sincronizarPreapprovalUsuario(String(byPayment.usuario_id)).catch(() => {})
    return
  }

  const ref =
    payment.external_reference != null && String(payment.external_reference).trim() !== ''
      ? String(payment.external_reference)
      : null

  let row = null
  if (ref) {
    const { data } = await supabase
      .from('pagamentos_mercadopago')
      .select('id, usuario_id')
      .eq('external_reference', ref)
      .maybeSingle()
    row = data
  }

  if (row?.id) {
    const { error } = await supabase.from('pagamentos_mercadopago').update(payload).eq('id', row.id)
    if (error) throw error
    if (row.usuario_id) void sincronizarPreapprovalUsuario(String(row.usuario_id)).catch(() => {})
    return
  }

  const metaUid =
    payment.metadata?.usuario_id ||
    payment.metadata?.usuarioId ||
    (typeof payment.metadata === 'object' && payment.metadata !== null
      ? Object.values(payment.metadata).find((v) => typeof v === 'string' && v.length === 36)
      : null)

  const externalRefInsert = ref || `mp-pay-${pid}`

  const { error } = await supabase.from('pagamentos_mercadopago').insert({
    external_reference: externalRefInsert,
    usuario_id: metaUid || null,
    preference_id: payment.preference_id ? String(payment.preference_id) : null,
    ...payload,
  })

  if (error) throw error
  if (metaUid) void sincronizarPreapprovalUsuario(String(metaUid)).catch(() => {})
}

const STATUS_FINAL_OK = new Set(['approved', 'authorized', 'accredited'])
const STATUS_FINAL_RUIM = new Set(['rejected', 'cancelled', 'refunded', 'charged_back'])

function escolherMelhorPagamentoMp(results) {
  if (!results?.length) return null
  const ok = results.filter((p) => STATUS_FINAL_OK.has(String(p.status || '').toLowerCase()))
  const pool = ok.length ? ok : results
  return pool.sort(
    (a, b) =>
      new Date(b.date_approved || b.date_last_updated || b.date_created || 0) -
      new Date(a.date_approved || a.date_last_updated || a.date_created || 0)
  )[0]
}

function precisaSincronizarStatus(status) {
  const s = String(status || '').toLowerCase()
  if (STATUS_FINAL_OK.has(s) || STATUS_FINAL_RUIM.has(s)) return false
  return true
}

/**
 * Atualiza no Supabase o status real vindo do MP (webhook às vezes não chega em produção).
 */
export async function sincronizarPagamentosPendentesDoUsuario(usuario_id) {
  const uid = String(usuario_id || '').trim()
  if (!uid || !isMercadoPagoConfigured()) return

  const supabase = getSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('pagamentos_mercadopago')
    .select('id, preference_id, payment_id, external_reference, status')
    .eq('usuario_id', uid)
    .order('created_at', { ascending: false })
    .limit(25)

  if (error || !rows?.length) return

  for (const row of rows) {
    if (!precisaSincronizarStatus(row.status)) continue

    try {
      if (row.payment_id) {
        const payment = await buscarPagamentoPorId(String(row.payment_id).trim())
        await upsertFromWebhookPayment(payment)
        continue
      }

      if (row.external_reference) {
        const results = await buscarPagamentosPorExternalReference(row.external_reference)
        const best = escolherMelhorPagamentoMp(results)
        if (best) await upsertFromWebhookPayment(best)
      }
    } catch (e) {
      logMercadoPagoSyncIssue('[sincronizarPagamentosPendentesDoUsuario]', row.external_reference || row.id, e)
    }
  }
}

export async function listPagamentosUsuario(usuario_id, limit = 20) {
  const uid = String(usuario_id || '').trim()
  if (!uid) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('pagamentos_mercadopago')
    .select(
      'id, preference_id, preapproval_id, payment_id, status, status_detail, amount, currency_id, description, external_reference, payer_email, created_at, updated_at'
    )
    .eq('usuario_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    log.warn('[listPagamentosUsuario]', error.message || error)
    return []
  }
  return data || []
}

/** Status MP que liberam assinatura (pagamento concluído ou autorizado). */
export const STATUS_PAGAMENTO_LIBERA_ACESSO = new Set([
  'approved',
  'authorized',
  'accredited', // algumas respostas / contas MP
])

function linhaPagamentoAprovada(row) {
  return STATUS_PAGAMENTO_LIBERA_ACESSO.has(String(row?.status || '').toLowerCase())
}

/**
 * Pagamento aprovado vinculado ao usuário OU ao e-mail do pagador (MP às vezes grava payer_email antes de usuario_id).
 * Nunca lança — falhas de tabela/rede retornam false (evita 500 no app).
 */
export async function usuarioTemPagamentoAprovado(usuario_id, payerEmail = null) {
  const uid = String(usuario_id || '').trim()
  if (!uid) return false

  const supabase = getSupabaseAdmin()

  try {
    const { data, error } = await supabase
      .from('pagamentos_mercadopago')
      .select('id, status')
      .eq('usuario_id', uid)
      .limit(50)

    if (error) {
      log.warn('[usuarioTemPagamentoAprovado] por usuario_id:', error.message || error)
    } else if ((data || []).some(linhaPagamentoAprovada)) {
      return true
    }

    const em = String(payerEmail || '').trim().toLowerCase()
    if (!em) return false

    const r2 = await supabase
      .from('pagamentos_mercadopago')
      .select('id, status, usuario_id, payer_email')
      .ilike('payer_email', em)
      .limit(80)

    if (r2.error) {
      log.warn('[usuarioTemPagamentoAprovado] por payer_email:', r2.error.message || r2.error)
      return false
    }

    const candidatos = (r2.data || []).filter(
      (row) =>
        linhaPagamentoAprovada(row) &&
        (!row.usuario_id || String(row.usuario_id).trim() === uid)
    )
    if (candidatos.length === 0) return false

    const semVinculo = candidatos.find((row) => !row.usuario_id && row.id)
    if (semVinculo) {
      const { error: upErr } = await supabase
        .from('pagamentos_mercadopago')
        .update({ usuario_id: uid })
        .eq('id', semVinculo.id)
      if (upErr) log.warn('[usuarioTemPagamentoAprovado] vincular usuario_id:', upErr.message || upErr)
    }
    return true
  } catch (e) {
    log.warn('[usuarioTemPagamentoAprovado]', e?.message || e)
    return false
  }
}

/**
 * Último registro MP por usuário + conjunto de quem tem pagamento aprovado/autorizado.
 * @param {string[]} userIds
 * @returns {Promise<{ latestByUser: Map<string, object>, approvedIds: Set<string> }>}
 */
export async function resumoPagamentosPorUsuarioIds(userIds) {
  const latestByUser = new Map()
  const approvedIds = new Set()
  const ids = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return { latestByUser, approvedIds }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('pagamentos_mercadopago')
    .select('usuario_id, status, amount, updated_at, created_at, status_detail')
    .in('usuario_id', ids)

  if (error) throw error
  const rows = data || []
  for (const r of rows) {
    const uid = r.usuario_id
    if (!uid) continue
    if (STATUS_PAGAMENTO_LIBERA_ACESSO.has(String(r.status || '').toLowerCase())) approvedIds.add(uid)
  }
  rows.sort((a, b) => {
    const tb = new Date(b.updated_at || b.created_at || 0).getTime()
    const ta = new Date(a.updated_at || a.created_at || 0).getTime()
    return tb - ta
  })
  for (const r of rows) {
    const uid = r.usuario_id
    if (uid && !latestByUser.has(uid)) latestByUser.set(uid, r)
  }
  return { latestByUser, approvedIds }
}

/**
 * Soma pagamentos aprovados por usuário (ganho acumulado, mês corrente UTC, última data).
 * @param {string[]} userIds
 * @returns {Promise<Map<string, { accumulatedRevenue: number, monthlyRevenue: number, lastPaymentDate: string|null }>>}
 */
export async function aggregatePagamentosFinanceirosPorUsuarioIds(userIds) {
  const map = new Map()
  const ids = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return map

  const startMonth = new Date()
  startMonth.setUTCDate(1)
  startMonth.setUTCHours(0, 0, 0, 0)
  const startMs = startMonth.getTime()

  const supabase = getSupabaseAdmin()
  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('pagamentos_mercadopago')
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

/**
 * Totais globais de pagamentos aprovados + quantidade de usuários distintos com ao menos um pagamento aprovado.
 */
export async function agregarPagamentosAprovadosGlobais() {
  const supabase = getSupabaseAdmin()
  const startMonth = new Date()
  startMonth.setUTCDate(1)
  startMonth.setUTCHours(0, 0, 0, 0)
  const startMs = startMonth.getTime()

  let accumulatedRevenue = 0
  let monthlyRevenue = 0
  const paidUserIds = new Set()
  const stList = [...STATUS_PAGAMENTO_LIBERA_ACESSO]

  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('pagamentos_mercadopago')
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

/** IDs de usuários com ao menos um pagamento aprovado/autorizado. */
export async function fetchUsuarioIdsComPagamentoAprovado() {
  const supabase = getSupabaseAdmin()
  const set = new Set()
  const stList = [...STATUS_PAGAMENTO_LIBERA_ACESSO]
  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('pagamentos_mercadopago')
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
  preference_id,
  preapproval_id,
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

const COLS_ADMIN_EXTRA = `, raw_payment`

const USUARIOS_EMBED_ADMIN = 'usuarios ( email, nome, isento_pagamento, assinatura_proxima_cobranca, assinatura_mp_status )'
const USUARIOS_EMBED_ADMIN_LEGACY = 'usuarios ( email, usuario, isento_pagamento, assinatura_proxima_cobranca, assinatura_mp_status )'

/** Status MP agrupados para filtros / resumo admin. */
const STATUS_GRUPO_PENDENTE = ['pending', 'in_process', 'in_mediation']
const STATUS_GRUPO_RECUSADO = ['rejected', 'cancelled']
const STATUS_GRUPO_ESTORNADO = ['refunded', 'charged_back']

/**
 * @param {object[]} rows
 * @param {{ truncated?: boolean }} meta
 */
export function computePaymentAdminSummary(rows, meta = {}) {
  const list = Array.isArray(rows) ? rows : []
  const now = Date.now()
  const startMonth = new Date()
  startMonth.setUTCDate(1)
  startMonth.setUTCHours(0, 0, 0, 0)
  const startMs = startMonth.getTime()

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
    } else if (STATUS_GRUPO_PENDENTE.includes(st)) {
      pendingCount += 1
      pendingAmount += amt
      const ca = r.created_at ? new Date(r.created_at).getTime() : now
      if (now - ca > 7 * 24 * 60 * 60 * 1000) overdueCount += 1
    } else if (STATUS_GRUPO_RECUSADO.includes(st)) {
      rejectedCount += 1
    } else if (STATUS_GRUPO_ESTORNADO.includes(st)) {
      refundedCount += 1
    }
  }

  const denom = approvedCount + rejectedCount
  const approvalRate = denom > 0 ? Math.round((approvedCount / denom) * 1000) / 10 : null

  nextDates.sort((a, b) => a - b)
  const nextPaymentDate = nextDates.length ? new Date(nextDates[0]).toISOString() : null

  /** Próximo vencimento operacional: menor próxima cobrança entre usuários nos registros. */
  const nextDueDate = nextPaymentDate

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
    nextDueDate,
    monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
    approvalRate,
    summaryTruncated: meta.truncated === true,
    ticketMedio: approvedCount > 0 ? Math.round((accumulatedRevenue / approvedCount) * 100) / 100 : 0,
  }
}

/**
 * Enriquece linha para painel admin (campos derivados; não altera o banco).
 * @param {object} row
 */
export function enrichPaymentLogAdminRow(row) {
  const raw = row.raw_payment && typeof row.raw_payment === 'object' ? row.raw_payment : {}
  const u = row.usuarios && typeof row.usuarios === 'object' ? row.usuarios : {}
  const st = String(row.status || '').toLowerCase()
  const createdMs = row.created_at ? new Date(row.created_at).getTime() : 0
  const pendingOld = STATUS_GRUPO_PENDENTE.includes(st) && Date.now() - createdMs > 7 * 24 * 60 * 60 * 1000

  return {
    ...row,
    /** Boleto / meios com data de expiração no payload MP (quando existir). */
    dueDate: raw.date_of_expiration || raw.date_of_expiration_iso || null,
    paymentMethod:
      raw.payment_method_id != null
        ? String(raw.payment_method_id)
        : raw.payment_type_id != null
          ? String(raw.payment_type_id)
          : raw.payment_type != null
            ? String(raw.payment_type)
            : null,
    provider: 'mercadopago',
    billingCycle: raw.metadata?.billing_cycle || raw.metadata?.subscription_type || null,
    lastPaymentDate: row.updated_at || row.created_at || null,
    failureReason: row.status_detail || null,
    attemptCount: raw.installments != null ? Number(raw.installments) : null,
    subscriptionStatus: u.assinatura_mp_status || null,
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
  let query = supabase
    .from('pagamentos_mercadopago')
    .select(`${COLS_FLAT.trim()}${COLS_ADMIN_EXTRA}, ${usuariosEmbed}`)

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
    query = query.in('status', STATUS_GRUPO_RECUSADO)
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

/**
 * Lista pagamentos para o painel admin com filtros, resumo agregado e linhas enriquecidas.
 * @param {{
 *   limit?: number
 *   statusGroup?: 'all' | 'approved' | 'pending' | 'rejected' | 'refunded'
 *   q?: string
 *   dateFrom?: string
 *   dateTo?: string
 *   sort?: 'created_desc' | 'created_asc' | 'amount_desc' | 'amount_asc'
 *   exempt?: 'all' | 'yes' | 'no'
 *   overdueOnly?: boolean | string
 * }} opts
 */
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
        assinatura_mp_status: u.assinatura_mp_status ?? null,
      },
    }
  })

  // Fallback: quando o relacionamento "usuarios (...)" não vem populado,
  // buscamos os usuários por ID para não perder nome/e-mail no painel.
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
      .select('id, email, nome, usuario, isento_pagamento, assinatura_proxima_cobranca, assinatura_mp_status')
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
            assinatura_mp_status: prev.assinatura_mp_status || user.assinatura_mp_status || null,
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
      const pref = (row.preference_id || '').toLowerCase()
      const payId = (row.payment_id || '').toLowerCase()
      const ext = (row.external_reference || '').toLowerCase()
      return (
        idStr.includes(q) ||
        email.includes(q) ||
        nome.includes(q) ||
        payer.includes(q) ||
        pref.includes(q) ||
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

/** Painel admin: todos os registros (com e-mail do usuário quando o relacionamento existir no Supabase). */
export async function listPagamentosAdmin(limit = 200) {
  const { rows } = await listPagamentosAdminPayload({ limit, statusGroup: 'all' })
  return rows
}

/** Mesmos status exibidos como "Pendente" no badge (MpStatusBadge). */
const STATUS_LOG_PENDENTE_MP = ['pending', 'in_process', 'in_mediation']

/**
 * Remove registros de log cujo status MP ainda é pendente / em análise.
 * Não remove aprovados, recusados nem preferências já finalizadas.
 */
export async function deletePagamentosPendentesAdmin() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('pagamentos_mercadopago')
    .delete()
    .in('status', STATUS_LOG_PENDENTE_MP)
    .select('id')

  if (error) throw error
  const deleted = Array.isArray(data) ? data.length : 0
  return { deleted }
}

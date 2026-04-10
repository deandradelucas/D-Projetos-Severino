import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import {
  buscarPagamentoPorId,
  buscarPagamentosPorExternalReference,
  buscarPreapprovalPorId,
  isMercadoPagoConfigured,
} from './mercadopago.mjs'

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
    if (!Number.isNaN(d.getTime())) nextIso = d.toISOString()
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
    log.warn('[sincronizarPreapprovalUsuario]', row.mp_preapproval_id, e?.message || e)
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
    log.warn('[sincronizarPreapprovalPorIdFromWebhook]', id, e?.message || e)
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
      log.warn('[sincronizarPagamentosPendentesDoUsuario]', row.external_reference || row.id, e?.message || e)
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

/** Painel admin: todos os registros (com e-mail do usuário quando o relacionamento existir no Supabase). */
export async function listPagamentosAdmin(limit = 200) {
  const supabase = getSupabaseAdmin()

  let withUser = await supabase
    .from('pagamentos_mercadopago')
    .select(`${COLS_FLAT.trim()}, usuarios ( email, nome, isento_pagamento )`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (withUser.error) {
    withUser = await supabase
      .from('pagamentos_mercadopago')
      .select(`${COLS_FLAT.trim()}, usuarios ( email, usuario, isento_pagamento )`)
      .order('created_at', { ascending: false })
      .limit(limit)
  }

  if (!withUser.error) {
    return (withUser.data || []).map((row) => {
      const u = row.usuarios
      if (!u || typeof u !== 'object') return row
      return {
        ...row,
        usuarios: {
          email: u.email,
          nome: u.nome ?? u.usuario ?? '',
          isento_pagamento: u.isento_pagamento === true,
        },
      }
    })
  }

  const flat = await supabase
    .from('pagamentos_mercadopago')
    .select(COLS_FLAT.trim())
    .order('created_at', { ascending: false })
    .limit(limit)

  if (flat.error) throw flat.error
  return flat.data || []
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

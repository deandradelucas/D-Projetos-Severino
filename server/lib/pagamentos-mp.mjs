import { getSupabaseAdmin } from './supabase-admin.mjs'

export async function insertPreferenciaRecord({
  usuario_id,
  preference_id,
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
 * Atualiza registro criado na preferência ou insere se o webhook chegar primeiro (raro).
 */
export async function upsertFromWebhookPayment(payment) {
  const ref = payment.external_reference
  if (!ref) return

  const supabase = getSupabaseAdmin()
  const { data: row } = await supabase
    .from('pagamentos_mercadopago')
    .select('id, usuario_id')
    .eq('external_reference', String(ref))
    .maybeSingle()

  const payload = {
    payment_id: String(payment.id),
    status: payment.status,
    status_detail: payment.status_detail || null,
    amount: payment.transaction_amount,
    currency_id: payment.currency_id || 'BRL',
    payer_email: payment.payer?.email || null,
    raw_payment: payment,
    updated_at: new Date().toISOString(),
  }

  if (row?.id) {
    const { error } = await supabase.from('pagamentos_mercadopago').update(payload).eq('id', row.id)
    if (error) throw error
    return
  }

  const metaUid =
    payment.metadata?.usuario_id ||
    payment.metadata?.usuarioId ||
    (typeof payment.metadata === 'object' && payment.metadata !== null
      ? Object.values(payment.metadata).find((v) => typeof v === 'string' && v.length === 36)
      : null)

  const { error } = await supabase.from('pagamentos_mercadopago').insert({
    external_reference: String(ref),
    usuario_id: metaUid || null,
    preference_id: payment.preference_id ? String(payment.preference_id) : null,
    ...payload,
  })

  if (error) throw error
}

export async function listPagamentosUsuario(usuario_id, limit = 20) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('pagamentos_mercadopago')
    .select(
      'id, preference_id, payment_id, status, status_detail, amount, currency_id, description, external_reference, payer_email, created_at, updated_at'
    )
    .eq('usuario_id', usuario_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

const COLS_FLAT = `
  id,
  usuario_id,
  preference_id,
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
    .select(`${COLS_FLAT.trim()}, usuarios ( email, nome )`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (withUser.error) {
    withUser = await supabase
      .from('pagamentos_mercadopago')
      .select(`${COLS_FLAT.trim()}, usuarios ( email, usuario )`)
      .order('created_at', { ascending: false })
      .limit(limit)
  }

  if (!withUser.error) {
    return (withUser.data || []).map((row) => {
      const u = row.usuarios
      if (!u || typeof u !== 'object') return row
      return {
        ...row,
        usuarios: { email: u.email, nome: u.nome ?? u.usuario ?? '' },
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

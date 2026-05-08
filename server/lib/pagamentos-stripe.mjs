import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { getStripe, isStripeConfigured } from './stripe-client.mjs'

/** @param {import('stripe').Stripe.Subscription} sub */
export async function applyStripeSubscriptionToUsuario(usuarioId, sub) {
  const uid = String(usuarioId || '').trim()
  if (!uid || !sub?.id) return
  const status = String(sub.status || '').trim()
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  const periodEnd =
    sub.current_period_end != null ? new Date(Number(sub.current_period_end) * 1000).toISOString() : null
  const supabase = getSupabaseAdmin()
  const patch = {
    stripe_customer_id: customerId ? String(customerId) : null,
    stripe_subscription_id: String(sub.id),
    stripe_subscription_status: status || null,
    assinatura_proxima_cobranca: periodEnd,
  }
  const { error } = await supabase.from('usuarios').update(patch).eq('id', uid)
  if (error) log.warn('[applyStripeSubscriptionToUsuario]', error.message || error)
}

export async function usuarioStripeSubscriptionLiberaAcesso(usuario_id) {
  const uid = String(usuario_id || '').trim()
  if (!uid || !isStripeConfigured()) return false
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('usuarios')
    .select('stripe_subscription_status')
    .eq('id', uid)
    .maybeSingle()
  if (error) {
    const msg = String(error.message || error.details || '')
    if (msg.includes('stripe_subscription_status') || msg.includes('42703')) return false
    log.warn('[usuarioStripeSubscriptionLiberaAcesso]', msg || error)
    return false
  }
  const s = String(data?.stripe_subscription_status || '').toLowerCase()
  return s === 'active' || s === 'trialing'
}

export async function sincronizarStripeUsuario(usuario_id) {
  const uid = String(usuario_id || '').trim()
  if (!uid || !isStripeConfigured()) return
  const stripe = getStripe()
  if (!stripe) return
  const supabase = getSupabaseAdmin()
  const { data: row, error } = await supabase.from('usuarios').select('stripe_subscription_id').eq('id', uid).maybeSingle()
  if (error) {
    const msg = String(error.message || '')
    if (msg.includes('stripe_subscription_id') || msg.includes('42703')) return
    log.warn('[sincronizarStripeUsuario] select', msg || error)
    return
  }
  const sid = row?.stripe_subscription_id ? String(row.stripe_subscription_id).trim() : ''
  if (!sid) return
  try {
    const sub = await stripe.subscriptions.retrieve(sid)
    await applyStripeSubscriptionToUsuario(uid, sub)
  } catch (e) {
    log.warn('[sincronizarStripeUsuario]', sid, e?.message || e)
  }
}

/**
 * @param {import('stripe').Stripe.Event} event
 */
export async function handleStripeWebhookEvent(event) {
  const stripe = getStripe()
  if (!stripe) return

  try {
    if (event.type === 'checkout.session.completed') {
      const session = /** @type {import('stripe').Stripe.Checkout.Session} */ (event.data.object)
      if (session.mode !== 'subscription') return
      const usuarioId = String(session.metadata?.usuario_id || session.client_reference_id || '').trim()
      if (!usuarioId) {
        log.warn('[stripe webhook] checkout.session.completed sem usuario_id', session.id)
        return
      }
      const subRef = session.subscription
      const subId = typeof subRef === 'string' ? subRef : subRef?.id
      if (!subId) return
      const sub = await stripe.subscriptions.retrieve(subId)
      await applyStripeSubscriptionToUsuario(usuarioId, sub)
      return
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = /** @type {import('stripe').Stripe.Subscription} */ (event.data.object)
      let usuarioId = String(sub.metadata?.usuario_id || '').trim()
      if (!usuarioId) {
        const supabase = getSupabaseAdmin()
        const { data } = await supabase
          .from('usuarios')
          .select('id')
          .eq('stripe_subscription_id', String(sub.id))
          .maybeSingle()
        usuarioId = data?.id ? String(data.id) : ''
      }
      if (!usuarioId) {
        log.warn('[stripe webhook] subscription sem usuario_id', sub.id)
        return
      }
      await applyStripeSubscriptionToUsuario(usuarioId, sub)
    }
  } catch (e) {
    log.error('[stripe webhook] handler', e?.message || e)
  }
}

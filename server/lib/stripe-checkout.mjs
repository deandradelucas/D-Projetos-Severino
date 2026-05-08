import { getStripe } from './stripe-client.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'

/**
 * @param {{
 *   usuarioId: string
 *   email: string
 *   plano: 'mensal' | 'anual'
 *   baseUrlApp: string
 * }} opts
 */
export async function criarStripeSubscriptionCheckoutSession(opts) {
  const stripe = getStripe()
  if (!stripe) throw new Error('STRIPE_SECRET_KEY não configurada no servidor.')

  const uid = String(opts.usuarioId || '').trim()
  const email = String(opts.email || '').trim().toLowerCase()
  if (!uid || !email) throw new Error('Dados do utilizador incompletos.')

  const plano = opts.plano === 'anual' ? 'anual' : 'mensal'
  const base = String(opts.baseUrlApp || '').replace(/\/+$/, '')

  const precoMensalCfg = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10')
  const precoAnualCfg = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO_ANUAL || '100')
  const pm = Number.isFinite(precoMensalCfg) && precoMensalCfg > 0 ? precoMensalCfg : 10
  const pa = Number.isFinite(precoAnualCfg) && precoAnualCfg > 0 ? precoAnualCfg : 100

  const priceIdMensal = String(process.env.STRIPE_PRICE_ID_MONTHLY || '').trim()
  const priceIdAnual = String(process.env.STRIPE_PRICE_ID_YEARLY || '').trim()

  const supabase = getSupabaseAdmin()
  const { data: urow, error: custErr } = await supabase.from('usuarios').select('stripe_customer_id').eq('id', uid).maybeSingle()
  let existingCustomer = null
  if (!custErr && urow?.stripe_customer_id && String(urow.stripe_customer_id).trim().startsWith('cus_')) {
    existingCustomer = String(urow.stripe_customer_id).trim()
  }

  /** @type {import('stripe').Stripe.Checkout.SessionCreateParams.LineItem} */
  let lineItem
  if (plano === 'anual') {
    if (priceIdAnual) {
      lineItem = { price: priceIdAnual, quantity: 1 }
    } else {
      lineItem = {
        price_data: {
          currency: 'brl',
          unit_amount: Math.round(pa * 100),
          recurring: { interval: 'year' },
          product_data: {
            name: 'Assinatura Severino (anual)',
          },
        },
        quantity: 1,
      }
    }
  } else {
    if (priceIdMensal) {
      lineItem = { price: priceIdMensal, quantity: 1 }
    } else {
      lineItem = {
        price_data: {
          currency: 'brl',
          unit_amount: Math.round(pm * 100),
          recurring: { interval: 'month' },
          product_data: {
            name: 'Assinatura Severino (mensal)',
          },
        },
        quantity: 1,
      }
    }
  }

  /** @type {import('stripe').Stripe.Checkout.SessionCreateParams} */
  const params = {
    mode: 'subscription',
    line_items: [lineItem],
    success_url: `${base}/pagamento?stripe=ok`,
    cancel_url: `${base}/pagamento?stripe=cancel`,
    client_reference_id: uid,
    metadata: { usuario_id: uid, plano },
    subscription_data: {
      metadata: { usuario_id: uid, plano },
    },
  }

  if (existingCustomer) {
    params.customer = existingCustomer
  } else {
    params.customer_email = email
  }

  return stripe.checkout.sessions.create(params)
}

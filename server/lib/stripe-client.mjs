import Stripe from 'stripe'

let stripeSingleton = null

export function isStripeConfigured() {
  return !!String(process.env.STRIPE_SECRET_KEY || '').trim()
}

/** @returns {Stripe|null} */
export function getStripe() {
  if (!isStripeConfigured()) return null
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(String(process.env.STRIPE_SECRET_KEY).trim(), { typescript: false })
  }
  return stripeSingleton
}

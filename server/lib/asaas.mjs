/** Cliente HTTP Asaas (assinatura via Checkout API v3). @see https://docs.asaas.com */

/** PNG 1×1 transparente — campo obrigatório em itens do checkout. */
export const ASAAS_CHECKOUT_ITEM_IMAGE_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export function getAsaasApiBase() {
  return String(process.env.ASAAS_API_BASE_URL || 'https://api.asaas.com/v3').replace(/\/+$/, '')
}

export function getAsaasAccessToken() {
  let t = String(process.env.ASAAS_API_KEY || process.env.ASAAS_ACCESS_TOKEN || '').trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim()
  }
  return t
}

export function isAsaasConfigured() {
  return !!getAsaasAccessToken()
}

/** Origem da página de checkout (link manual com id da sessão). */
export function getAsaasCheckoutOrigin() {
  const base = getAsaasApiBase().toLowerCase()
  if (base.includes('sandbox')) {
    return String(process.env.ASAAS_CHECKOUT_ORIGIN || 'https://sandbox.asaas.com').replace(/\/+$/, '')
  }
  return String(process.env.ASAAS_CHECKOUT_ORIGIN || 'https://www.asaas.com').replace(/\/+$/, '')
}

export function montarUrlCheckoutAsaas(checkoutSessionId) {
  const id = String(checkoutSessionId || '').trim()
  if (!id) return ''
  return `${getAsaasCheckoutOrigin()}/checkoutSession/show?id=${encodeURIComponent(id)}`
}

export function urlPortalAssinaturaAsaasPadrao() {
  return String(process.env.ASAAS_URL_MINHA_CONTA || 'https://www.asaas.com').replace(/\/+$/, '')
}

export function parseUsuarioIdFromExternalReference(ref) {
  const s = String(ref || '').trim()
  const m = /^hf-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-/i.exec(s)
  return m ? m[1] : null
}

export function asaasHttpError(res, json, prefix) {
  const msg =
    json?.errors?.[0]?.description ||
    json?.message ||
    (typeof json === 'string' ? json : '') ||
    `${prefix}: HTTP ${res.status}`
  const err = new Error(msg)
  err.status = res.status
  err.asaas = json
  return err
}

export function isAsaasForbiddenError(err) {
  const code = Number(err?.status || err?.response?.status || 0)
  return code === 401 || code === 403
}

function formatYmd(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addYears(d, n) {
  const x = new Date(d.getTime())
  x.setUTCFullYear(x.getUTCFullYear() + n)
  return x
}

/**
 * @param {string} path - relativo à base (ex.: `/payments/xyz`)
 * @param {RequestInit} options
 */
export async function asaasFetch(path, options = {}) {
  const token = getAsaasAccessToken()
  const p = path.startsWith('/') ? path : `/${path}`
  const url = `${getAsaasApiBase()}${p}`
  const res = await fetch(url, {
    ...options,
    headers: {
      access_token: token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw asaasHttpError(res, json, 'Asaas')
  return json
}

export async function buscarCobrancaAsaas(paymentId) {
  const id = String(paymentId || '').trim()
  if (!id) throw new Error('ID de cobrança inválido.')
  return asaasFetch(`/payments/${encodeURIComponent(id)}`, { method: 'GET' })
}

export async function buscarAssinaturaAsaas(subscriptionId) {
  const id = String(subscriptionId || '').trim()
  if (!id) throw new Error('ID de assinatura inválido.')
  return asaasFetch(`/subscriptions/${encodeURIComponent(id)}`, { method: 'GET' })
}

/**
 * Checkout recorrente mensal (cartão / Pix conforme billingTypes).
 * @param {{
 *   baseUrlApp: string
 *   usuarioId: string
 *   email: string
 *   nome?: string|null
 *   telefone?: string|null
 *   tituloItem: string
 *   valorMensal: number
 *   externalReference: string
 * }} opts
 */
export async function criarCheckoutAssinaturaRecorrente(opts) {
  const token = getAsaasAccessToken()
  if (!token) throw new Error('ASAAS_API_KEY não configurada no servidor.')

  const baseUrlApp = String(opts.baseUrlApp || '').replace(/\/+$/, '')
  const titulo = String(opts.tituloItem || 'Assinatura mensal').trim()
  const itemName = titulo.slice(0, 30)
  const phoneDigits = String(opts.telefone || '').replace(/\D/g, '').slice(0, 16)

  const now = new Date()
  const nextDue = formatYmd(now)
  const endDate = formatYmd(addYears(now, 10))

  const body = {
    billingTypes: ['CREDIT_CARD', 'PIX'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: 1440,
    externalReference: String(opts.externalReference || '').trim(),
    callback: {
      successUrl: `${baseUrlApp}/pagamento?asaas=ok`,
      cancelUrl: `${baseUrlApp}/pagamento?asaas=cancel`,
      expiredUrl: `${baseUrlApp}/pagamento?asaas=expirado`,
    },
    items: [
      {
        name: itemName || 'Assinatura',
        description: titulo.slice(0, 150),
        quantity: 1,
        value: Number(opts.valorMensal),
        imageBase64: ASAAS_CHECKOUT_ITEM_IMAGE_B64,
      },
    ],
    customerData: {
      name: String(opts.nome || 'Cliente').trim().slice(0, 80) || 'Cliente',
      email: String(opts.email || '').trim().toLowerCase(),
      ...(phoneDigits ? { phone: phoneDigits } : {}),
    },
    subscription: {
      cycle: 'MONTHLY',
      nextDueDate: nextDue,
      endDate,
    },
  }

  return asaasFetch('/checkouts', { method: 'POST', body: JSON.stringify(body) })
}

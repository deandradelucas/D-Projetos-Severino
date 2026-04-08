import { loadEnv } from './load-env.mjs'

const MP_API = 'https://api.mercadopago.com'

export function getMercadoPagoAccessToken() {
  loadEnv()
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
}

export function getMercadoPagoPublicKey() {
  loadEnv()
  return process.env.MERCADO_PAGO_PUBLIC_KEY || ''
}

export function isMercadoPagoConfigured() {
  return !!getMercadoPagoAccessToken()
}

/** Token de teste do MP costuma começar com TEST- */
export function useSandboxCheckout(accessToken) {
  return String(accessToken || '').trim().startsWith('TEST-')
}

/**
 * Cria preferência de checkout (redirect para Mercado Pago).
 * @param {object} opts
 * @param {string} opts.baseUrl - Origem do app (https://...) sem barra final
 * @param {string} opts.usuarioId
 * @param {string} opts.email
 * @param {string} opts.title
 * @param {number} opts.unitPrice - Valor unitário em BRL (ex.: 29.9)
 * @param {string} opts.externalReference - idempotência / rastreio
 */
export async function criarPreferenciaCheckout(opts) {
  const accessToken = getMercadoPagoAccessToken()
  if (!accessToken) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurada no servidor.')
  }

  const {
    baseUrl,
    usuarioId,
    email,
    title,
    unitPrice,
    externalReference,
    quantity = 1,
  } = opts

  const cleanBase = String(baseUrl || '').replace(/\/+$/, '')
  const notificationUrl = `${cleanBase}/api/pagamentos/webhook`

  const body = {
    items: [
      {
        title: String(title || 'Horizonte Financeiro'),
        quantity: Math.max(1, Number(quantity) || 1),
        unit_price: Number(Number(unitPrice).toFixed(2)),
        currency_id: 'BRL',
      },
    ],
    payer: { email: String(email || '').trim() },
    external_reference: String(externalReference),
    back_urls: {
      success: `${cleanBase}/pagamento?status=success`,
      failure: `${cleanBase}/pagamento?status=failure`,
      pending: `${cleanBase}/pagamento?status=pending`,
    },
    auto_return: 'approved',
    notification_url: notificationUrl,
    statement_descriptor: 'HORIZONTE',
    metadata: {
      usuario_id: usuarioId,
    },
  }

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json.message || json.error || res.statusText
    throw new Error(`Mercado Pago: ${msg}`)
  }

  return {
    id: json.id,
    init_point: json.init_point,
    sandbox_init_point: json.sandbox_init_point,
  }
}

export async function buscarPagamentoPorId(paymentId) {
  const accessToken = getMercadoPagoAccessToken()
  if (!accessToken) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurada.')
  }

  const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json.message || json.error || res.statusText
    throw new Error(`Mercado Pago pagamento: ${msg}`)
  }
  return json
}

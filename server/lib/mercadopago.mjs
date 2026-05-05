import './load-env.mjs'

const MP_API = 'https://api.mercadopago.com'

/**
 * Erro da API MP com `mpHttpStatus` (ex.: 403 = Forbidden — token/ambiente/recurso incompatível).
 * @param {Response} res
 * @param {object} json
 * @param {string} prefix
 */
export function mercadoPagoHttpError(res, json, prefix) {
  const msg = json?.message || json?.error || res.statusText || 'erro'
  const e = new Error(`${prefix}: ${msg}`)
  e.mpHttpStatus = res.status
  return e
}

/** 403 ou texto "Forbidden" no corpo (alguns fluxos só refletem no message). */
export function isMercadoPagoForbiddenError(err) {
  if (!err) return false
  if (err.mpHttpStatus === 403) return true
  const m = String(err.message || '')
  if (/forbidden/i.test(m)) return true
  if (/\b403\b/.test(m)) return true
  return false
}

export function getMercadoPagoAccessToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
}

export function getMercadoPagoPublicKey() {
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
    throw mercadoPagoHttpError(res, json, 'Mercado Pago')
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
    throw mercadoPagoHttpError(res, json, 'Mercado Pago pagamento')
  }
  return json
}

/**
 * Lista pagamentos no MP pelo external_reference da preferência (quando o webhook não atualizou o banco).
 * @see https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_search/get
 */
export async function buscarPagamentosPorExternalReference(externalReference) {
  const accessToken = getMercadoPagoAccessToken()
  if (!accessToken) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurada.')
  }

  const ref = String(externalReference || '').trim()
  if (!ref) return []

  const qs = new URLSearchParams({
    sort: 'date_created',
    criteria: 'desc',
    external_reference: ref,
  })

  const res = await fetch(`${MP_API}/v1/payments/search?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw mercadoPagoHttpError(res, json, 'Mercado Pago busca pagamentos')
  }

  return Array.isArray(json.results) ? json.results : []
}

/**
 * Assinatura mensal (preapproval): cobrança recorrente no cartão, valor creditado na conta Mercado Pago do vendedor.
 * @see https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval/post
 */
export async function criarPreapprovalAssinaturaMensal(opts) {
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
  } = opts

  const cleanBase = String(baseUrl || '').replace(/\/+$/, '')
  const notificationUrl = `${cleanBase}/api/pagamentos/webhook`

  /* Primeira cobrança recorrente no mês seguinte (não no mesmo mês da compra). */
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12, 0, 0, 0))
  if (start.getTime() <= now.getTime() + 60_000) {
    start.setUTCMonth(start.getUTCMonth() + 1)
  }
  const end = new Date()
  end.setFullYear(end.getFullYear() + 5)

  const body = {
    reason: String(title || 'Assinatura mensal Horizonte Financeiro'),
    external_reference: String(externalReference),
    payer_email: String(email || '').trim(),
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: Number(Number(unitPrice).toFixed(2)),
      currency_id: 'BRL',
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    },
    back_url: `${cleanBase}/pagamento?mp=sub_ok`,
    notification_url: notificationUrl,
    metadata: {
      usuario_id: String(usuarioId),
    },
    status: 'pending',
  }

  const res = await fetch(`${MP_API}/preapproval`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = json.message || json.cause?.[0]?.description || json.error || res.statusText
    throw mercadoPagoHttpError(res, { message: detail }, 'Mercado Pago assinatura')
  }

  return {
    id: json.id,
    init_point: json.init_point,
    sandbox_init_point: json.sandbox_init_point,
    status: json.status,
    next_payment_date: json.next_payment_date,
  }
}

export async function buscarPreapprovalPorId(preapprovalId) {
  const accessToken = getMercadoPagoAccessToken()
  if (!accessToken) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurada.')
  }

  const res = await fetch(`${MP_API}/preapproval/${encodeURIComponent(String(preapprovalId).trim())}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw mercadoPagoHttpError(res, json, 'Mercado Pago preapproval')
  }
  return json
}

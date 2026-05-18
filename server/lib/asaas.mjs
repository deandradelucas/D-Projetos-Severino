/** Cliente HTTP Asaas (assinatura via Checkout API v3). @see https://docs.asaas.com */

/** PNG 1×1 transparente — campo obrigatório em itens do checkout. */
export const ASAAS_CHECKOUT_ITEM_IMAGE_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export function getAsaasApiBase() {
  let u = String(process.env.ASAAS_API_BASE_URL || 'https://api.asaas.com/v3').trim()
  // Colagem de planilha / .env mal formatado pode prefixar '=' (fetch falha a parsear URL).
  while (u.startsWith('=')) u = u.slice(1).trim()
  return u.replace(/\/+$/, '')
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

/**
 * @param {string} path - relativo à base (ex.: `/payments/xyz`)
 * @param {RequestInit} options
 */
export async function asaasFetch(path, options = {}) {
  const token = getAsaasAccessToken()
  const p = path.startsWith('/') ? path : `/${path}`
  const url = `${getAsaasApiBase()}${p}`
  const method = String(options.method || 'GET').toUpperCase()
  const headers = {
    access_token: token,
    ...(options.headers || {}),
  }
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, {
    ...options,
    headers,
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

export async function cancelarAssinaturaAsaas(subscriptionId) {
  const id = String(subscriptionId || '').trim()
  if (!id) throw new Error('ID de assinatura inválido.')
  return asaasFetch(`/subscriptions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/**
 * Localiza cliente Asaas pelo CPF/CNPJ ou e-mail. Cria se não encontrar.
 * Retorna o customerId.
 */
export async function findOrCreateAsaasCustomer({ name, email, cpfCnpj, phone }) {
  const cpf = String(cpfCnpj || '').replace(/\D/g, '')
  const emailClean = String(email || '').trim().toLowerCase()

  if (cpf) {
    const res = await asaasFetch(`/customers?cpfCnpj=${encodeURIComponent(cpf)}&limit=1`)
    const existing = res?.data?.[0]
    if (existing?.id) return existing.id
  }

  const customer = await asaasFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: String(name || 'Cliente').trim().slice(0, 80) || 'Cliente',
      email: emailClean,
      ...(cpf ? { cpfCnpj: cpf } : {}),
      ...(phone ? { mobilePhone: String(phone).replace(/\D/g, '').slice(0, 11) } : {}),
    }),
  })
  return customer.id
}

/**
 * Cria assinatura recorrente no Asaas via API (não checkout session).
 * Retorna { id, checkoutUrl } onde checkoutUrl é o invoiceUrl do 1º pagamento.
 */
export async function criarAssinaturaComLink(opts) {
  const token = getAsaasAccessToken()
  if (!token) throw new Error('ASAAS_API_KEY não configurada no servidor.')

  const cycle = opts.cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
  const valor = Number(opts.valor ?? opts.valorMensal)
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor do plano inválido.')

  const cpfCnpjDigits = String(opts.cpfCnpj || '').replace(/\D/g, '').slice(0, 14)
  const phoneDigits = String(opts.telefone || '').replace(/\D/g, '').slice(0, 11)

  const customerId = await findOrCreateAsaasCustomer({
    name: opts.nome,
    email: opts.email,
    cpfCnpj: cpfCnpjDigits,
    phone: phoneDigits,
  })

  const now = new Date()
  const subscription = await asaasFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType: 'CREDIT_CARD',
      nextDueDate: formatYmd(now),
      value: valor,
      cycle,
      description: String(opts.tituloItem || 'Assinatura').trim().slice(0, 100),
      externalReference: String(opts.externalReference || '').trim(),
    }),
  })

  if (!subscription?.id) throw new Error('Asaas não retornou ID da assinatura.')

  const paymentsRes = await asaasFetch(
    `/payments?subscription=${encodeURIComponent(subscription.id)}&limit=1`,
  )
  const firstPayment = paymentsRes?.data?.[0]
  const checkoutUrl = firstPayment?.invoiceUrl || ''

  if (!checkoutUrl) throw new Error('Asaas não retornou link de pagamento para a assinatura.')

  return { id: subscription.id, checkoutUrl, checkoutSessionId: subscription.id }
}

/** @deprecated — usar criarAssinaturaComLink */
export async function criarCheckoutAssinatura(opts) {
  return criarAssinaturaComLink(opts)
}

/** @deprecated use criarCheckoutAssinatura com cycle MONTHLY */
export async function criarCheckoutAssinaturaRecorrente(opts) {
  return criarCheckoutAssinatura({
    ...opts,
    valor: opts.valorMensal,
    cycle: 'MONTHLY',
  })
}

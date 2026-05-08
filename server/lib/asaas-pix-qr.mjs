import { randomUUID } from 'node:crypto'
import { asaasFetch } from './asaas.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'

/** CPF/CNPJ só dígitos; mínimo 11 para CPF. */
export function normalizarCpfCnpjDigits(v) {
  const d = String(v || '').replace(/\D/g, '')
  if (d.length < 11 || d.length > 14) return ''
  return d
}

function addDaysUtc(d, n) {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function formatYmdUtc(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export class AsaasPixPrecisaCpfError extends Error {
  constructor(message = 'Informe CPF ou CNPJ para criar o cliente no Asaas e gerar o Pix.') {
    super(message)
    this.code = 'NEEDS_CPF'
  }
}

export async function listarClientesAsaasPorEmail(email) {
  const em = String(email || '').trim().toLowerCase()
  if (!em) return []
  const q = new URLSearchParams({ email: em, limit: '10' })
  const json = await asaasFetch(`/customers?${q.toString()}`, { method: 'GET' })
  const arr = Array.isArray(json?.data) ? json.data : []
  return arr
}

export async function criarClienteAsaas({ name, email, cpfCnpj, externalReference }) {
  const doc = normalizarCpfCnpjDigits(cpfCnpj)
  if (!doc) throw new Error('CPF/CNPJ inválido para cadastro no Asaas.')
  const body = {
    name: String(name || 'Cliente').trim().slice(0, 80) || 'Cliente',
    email: String(email || '').trim().toLowerCase(),
    cpfCnpj: doc,
    externalReference: String(externalReference || '').trim().slice(0, 100),
  }
  return asaasFetch('/customers', { method: 'POST', body: JSON.stringify(body) })
}

export async function criarCobrancaPixAsaas({ customerId, value, dueDate, description, externalReference }) {
  const cid = String(customerId || '').trim()
  if (!cid.startsWith('cus_')) throw new Error('Cliente Asaas inválido.')
  const val = Number(value)
  if (!Number.isFinite(val) || val <= 0) throw new Error('Valor Pix inválido.')
  return asaasFetch('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: cid,
      billingType: 'PIX',
      value: val,
      dueDate: String(dueDate || '').trim(),
      description: String(description || 'Cobrança Pix').slice(0, 140),
      externalReference: String(externalReference || '').trim().slice(0, 200),
    }),
  })
}

export async function obterPixQrCodeAsaas(paymentId) {
  const id = String(paymentId || '').trim()
  if (!id) throw new Error('ID de cobrança inválido.')
  return asaasFetch(`/payments/${encodeURIComponent(id)}/pixQrCode`, { method: 'GET' })
}

/**
 * Garante `cus_` no utilizador: coluna `asaas_customer_id`, lista por e-mail ou cria com CPF.
 * @param {{ usuarioId: string, email: string, nome: string, cpfCnpjOpcional?: string|null }} p
 * @returns {Promise<string>}
 */
export async function garantirAsaasCustomerIdUsuario(p) {
  const uid = String(p.usuarioId || '').trim()
  if (!uid) throw new Error('Utilizador inválido.')
  const supabase = getSupabaseAdmin()
  const { data: row, error } = await supabase.from('usuarios').select('asaas_customer_id').eq('id', uid).maybeSingle()
  if (error) throw error
  const existing = row?.asaas_customer_id ? String(row.asaas_customer_id).trim() : ''
  if (existing.startsWith('cus_')) return existing

  const email = String(p.email || '').trim().toLowerCase()
  if (!email) throw new Error('E-mail obrigatório para Pix no Asaas.')

  const found = await listarClientesAsaasPorEmail(email)
  const first = found.find((c) => c?.id && String(c.id).startsWith('cus_') && !c.deleted)
  if (first?.id) {
    const cid = String(first.id)
    await supabase.from('usuarios').update({ asaas_customer_id: cid }).eq('id', uid)
    return cid
  }

  const cpf = normalizarCpfCnpjDigits(p.cpfCnpjOpcional)
  if (!cpf) {
    throw new AsaasPixPrecisaCpfError()
  }

  const created = await criarClienteAsaas({
    name: p.nome || 'Cliente',
    email,
    cpfCnpj: cpf,
    externalReference: uid,
  })
  const cid = created?.id != null ? String(created.id).trim() : ''
  if (!cid.startsWith('cus_')) throw new Error('Asaas não devolveu id de cliente.')
  await supabase.from('usuarios').update({ asaas_customer_id: cid }).eq('id', uid)
  return cid
}

/**
 * Cria cobrança Pix avulsa (plano anual), registo em `pagamentos_asaas` e devolve dados do QR.
 * Renovação anual: nova cobrança no ano seguinte (não é assinatura recorrente Asaas).
 */
export async function criarPixAnualComQrCode(opts) {
  const usuarioId = String(opts.usuarioId || '').trim()
  const valor = Number(opts.valorAnual)
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor anual inválido.')

  const customerId = await garantirAsaasCustomerIdUsuario({
    usuarioId,
    email: opts.email,
    nome: opts.nome,
    cpfCnpjOpcional: opts.cpfCnpjOpcional,
  })

  const externalRef = `hf-${usuarioId}-${randomUUID()}`
  const due = formatYmdUtc(addDaysUtc(new Date(), Number.parseInt(process.env.HORIZONTE_PIX_VENCIMENTO_DIAS || '7', 10) || 7))

  const payment = await criarCobrancaPixAsaas({
    customerId,
    value: valor,
    dueDate: due,
    description: String(opts.descricao || 'Severino — plano anual (Pix)').slice(0, 140),
    externalReference: externalRef,
  })

  const payId = payment?.id != null ? String(payment.id) : ''
  if (!payId) throw new Error('Asaas não devolveu id da cobrança Pix.')

  const supabase = getSupabaseAdmin()
  const { error: insErr } = await supabase.from('pagamentos_asaas').insert({
    usuario_id: usuarioId,
    checkout_id: null,
    subscription_id: null,
    payment_id: payId,
    external_reference: externalRef,
    amount: valor,
    description: String(opts.descricao || 'Plano anual — Pix'),
    status: String(payment.status || 'PENDING').toLowerCase(),
    status_detail: 'PIX',
    currency_id: 'BRL',
    payer_email: String(opts.email || '').trim().toLowerCase() || null,
    raw_payload: payment,
  })
  if (insErr) throw insErr

  let qr = null
  try {
    qr = await obterPixQrCodeAsaas(payId)
  } catch {
    await new Promise((r) => setTimeout(r, 600))
    qr = await obterPixQrCodeAsaas(payId)
  }

  const encoded = qr?.encodedImage != null ? String(qr.encodedImage) : ''
  const payload = qr?.payload != null ? String(qr.payload) : ''
  const exp = qr?.expirationDate != null ? String(qr.expirationDate) : ''

  return {
    payment_id: payId,
    encoded_image: encoded.replace(/^=/, '').trim(),
    payload,
    expiration_date: exp,
    due_date: due,
  }
}

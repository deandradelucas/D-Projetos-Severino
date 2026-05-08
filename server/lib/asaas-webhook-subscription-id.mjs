/**
 * Extrai o id da assinatura do JSON do webhook Asaas (formatos comuns).
 * @param {Record<string, unknown>} body
 * @returns {string}
 */
export function subscriptionIdFromAsaasWebhookBody(body) {
  const sub = body?.subscription
  if (sub && typeof sub === 'object') {
    const sid = sub.id ?? sub.subscription
    if (sid != null && String(sid).trim() !== '') return String(sid).trim()
  }
  if (body?.object === 'subscription' && body?.id != null && String(body.id).trim() !== '') {
    return String(body.id).trim()
  }
  return ''
}

/**
 * Token do webhook WhatsApp (query/path/body).
 * Em produção (Vercel ou NODE_ENV=production) não há fallback em código — evita token público no repositório.
 */

const LOCAL_DEV_FALLBACK = 'ece58f64012d51028d28a04264d07131'

function isProdLike() {
  return process.env.VERCEL === '1' || String(process.env.NODE_ENV || '').toLowerCase() === 'production'
}

/**
 * @returns {{ token: string, missingInProduction: boolean }}
 */
export function resolveWhatsAppWebhookToken() {
  const envTok = String(process.env.WHATSAPP_WEBHOOK_TOKEN || '').trim()
  if (envTok) return { token: envTok, missingInProduction: false }
  if (isProdLike()) return { token: '', missingInProduction: true }
  return { token: LOCAL_DEV_FALLBACK, missingInProduction: false }
}

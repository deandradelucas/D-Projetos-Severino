/** Limite simples em memória (reinicia a cada deploy). Produção com várias instâncias: usar Redis/Upstash. */
const buckets = new Map()

export function rateLimitTake(key, max = 30, windowMs = 60_000) {
  const k = String(key || 'unknown').slice(0, 200)
  const now = Date.now()
  let b = buckets.get(k)
  if (!b || now > b.resetAt) {
    b = { n: 0, resetAt: now + windowMs }
    buckets.set(k, b)
  }
  b.n += 1
  if (b.n > max) return false
  return true
}

export function clientKeyFromHono(c) {
  const xf = c.req.header('x-forwarded-for')
  const first = xf ? xf.split(',')[0].trim() : ''
  return first || c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || 'unknown'
}

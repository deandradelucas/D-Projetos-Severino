import Redis from 'ioredis'

/**
 * Rate limit com Redis (quando REDIS_URL está definida) ou in-memory como fallback.
 * Usa fixed-window com INCR + PEXPIRE — atômico e correto por design.
 */

let _redis = null

function getRedis() {
  if (_redis) return _redis
  const url = process.env.REDIS_URL
  if (!url) return null
  _redis = new Redis(url, {
    lazyConnect: true,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    commandTimeout: 2000,
  })
  _redis.on('error', () => { /* suprime stack trace — reconecta automaticamente */ })
  return _redis
}

/* Fallback: in-memory (reinicia a cada deploy; adequado para worker único PM2) */
const buckets = new Map()

function rateLimitInMemory(key, max, windowMs) {
  const k = String(key || 'unknown').slice(0, 200)
  const now = Date.now()
  let b = buckets.get(k)
  if (!b || now > b.resetAt) {
    b = { n: 0, resetAt: now + windowMs }
    buckets.set(k, b)
  }
  b.n += 1
  return b.n <= max
}

export async function rateLimitTake(key, max = 30, windowMs = 60_000) {
  const k = `rl:${String(key || 'unknown').slice(0, 190)}`
  const redis = getRedis()

  if (redis) {
    try {
      /* Lua garante atomicidade: INCR + PEXPIRE em um único round-trip */
      const lua = `
        local c = redis.call('INCR', KEYS[1])
        if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
        return c`
      const count = await redis.eval(lua, 1, k, String(windowMs))
      return Number(count) <= max
    } catch {
      /* Redis indisponível — cai para in-memory */
    }
  }

  return rateLimitInMemory(key, max, windowMs)
}

export function clientKeyFromHono(c) {
  const xf = c.req.header('x-forwarded-for')
  const first = xf ? xf.split(',')[0].trim() : ''
  return first || c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || 'unknown'
}

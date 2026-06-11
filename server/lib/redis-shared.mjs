// @ts-check
import Redis from 'ioredis'

/**
 * Conexão Redis compartilhada (rate limit, cache de IA, telemetria).
 * Singleton lazy: só conecta se REDIS_URL existe; sem ela, retorna null e os
 * consumidores caem para o próprio fallback in-memory.
 */

let _redis = null
let _tried = false

export function getRedis() {
  if (_tried) return _redis
  _tried = true
  const url = process.env.REDIS_URL
  if (!url) return null
  _redis = new Redis(url, {
    lazyConnect: true,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    commandTimeout: 2000,
  })
  _redis.on('error', () => { /* suprime stack — reconecta sozinho */ })
  return _redis
}

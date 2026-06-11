// @ts-check
import { getRedis } from '../redis-shared.mjs'
import { hojeYmdBrt } from '../date-brt.mjs'

/**
 * Telemetria de consumo de IA (Story F1). Conta, por dia BRT:
 *   ia:<dia>:<provider>:<fluxo>:<resultado>   (gemini|groq|cache · parse-tx|... · ok|fail)
 *   ia:<dia>:cache:<hit|miss>
 *
 * Objetivo: medir o gargalo real (quem gasta Gemini, quanto o cache alivia) para
 * embasar a decisão de provider pago na fase 2 — sem achismo. Best-effort: nunca
 * lança, nunca bloqueia o fluxo de IA. Redis com fallback in-memory.
 */

const TTL_SECONDS = 48 * 60 * 60
/** @type {Map<string, number>} */
const memCounters = new Map()

function bump(field) {
  const key = `ia:${hojeYmdBrt()}:${field}`
  const redis = getRedis()
  if (redis) {
    redis.multi().incr(key).expire(key, TTL_SECONDS).exec().catch(() => {})
    return
  }
  memCounters.set(key, (memCounters.get(key) || 0) + 1)
}

/** Registra uma chamada de IA. provider: gemini|groq · resultado: ok|fail */
export function recordAiCall(provider, fluxo, resultado) {
  try { bump(`${provider}:${fluxo}:${resultado}`) } catch { /* noop */ }
}

/** Registra hit/miss de cache. */
export function recordCache(hit) {
  try { bump(`cache:${hit ? 'hit' : 'miss'}`) } catch { /* noop */ }
}

/** Snapshot do dia atual (para GET /api/health). Não expõe dados de usuário. */
export async function aiTelemetrySnapshot() {
  const dia = hojeYmdBrt()
  const prefix = `ia:${dia}:`
  const out = {}
  const redis = getRedis()
  if (redis) {
    try {
      const keys = await redis.keys(`${prefix}*`)
      if (keys.length) {
        const vals = await redis.mget(keys)
        keys.forEach((k, i) => { out[k.slice(prefix.length)] = Number(vals[i]) || 0 })
      }
      return { dia, ...out }
    } catch {
      /* cai para memória */
    }
  }
  for (const [k, v] of memCounters) {
    if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v
  }
  return { dia, ...out }
}

/** Só para testes. */
export function _resetMemCounters() {
  memCounters.clear()
}

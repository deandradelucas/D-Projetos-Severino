// @ts-check
import crypto from 'node:crypto'
import { getRedis } from '../redis-shared.mjs'

/**
 * Cache de respostas de IA determinísticas (Story F1).
 *
 * Mesma frase → mesma resposta sem gastar quota do Gemini/Groq. Usa Redis
 * (REDIS_URL, já em prod) com fallback para LRU em memória — funciona idêntico
 * sem Redis. Só cacheia fluxos determinísticos (parse de transação, lista,
 * categoria, título de agenda); chat e análise NÃO passam por aqui.
 *
 * O valor é serializado como JSON. Chamadas guardam o RESULTADO já parseado.
 */

const MAX_MEM_ENTRIES = 2000
/** @type {Map<string, { value: string, expiresAt: number }>} */
const memCache = new Map()

function memGet(key) {
  const hit = memCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    memCache.delete(key)
    return null
  }
  // LRU: reinsere para marcar como recém-usado
  memCache.delete(key)
  memCache.set(key, hit)
  return hit.value
}

function memSet(key, value, ttlMs) {
  if (memCache.size >= MAX_MEM_ENTRIES) {
    const oldest = memCache.keys().next().value
    if (oldest !== undefined) memCache.delete(oldest)
  }
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/**
 * Monta a chave de cache. `kind` separa namespaces (parse-tx, lista, categoria…).
 * `parts` são os componentes que definem a resposta — normalize ANTES de passar
 * (lowercase/trim) para maximizar hits. Inclua a data BRT em fluxos sensíveis a
 * "hoje/ontem" para não vazar entre dias.
 */
export function aiCacheKey(kind, ...parts) {
  const raw = parts.map((p) => String(p ?? '')).join('|')
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
  return `aic:${kind}:${hash}`
}

/** Lê do cache. Retorna o objeto desserializado ou null. */
export async function aiCacheGet(key) {
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get(key)
      if (raw != null) return JSON.parse(raw)
    } catch {
      /* Redis indisponível — cai para memória */
    }
  }
  const mem = memGet(key)
  return mem != null ? JSON.parse(mem) : null
}

/** Grava no cache (TTL em segundos). Falha de Redis é silenciosa. */
export async function aiCacheSet(key, value, ttlSeconds) {
  let serial
  try {
    serial = JSON.stringify(value)
  } catch {
    return // valor não serializável — não cacheia
  }
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, serial, 'EX', ttlSeconds)
      return
    } catch {
      /* cai para memória */
    }
  }
  memSet(key, serial, ttlSeconds * 1000)
}

/** TTLs padrão por tipo (segundos). */
export const AI_CACHE_TTL = {
  parseTransacao: 24 * 60 * 60, // 24h — chave inclui data BRT
  listaCompras: 24 * 60 * 60,
  categoria: 7 * 24 * 60 * 60, // 7d — chave inclui hash das categorias do usuário
  tituloAgenda: 24 * 60 * 60,
}

/** Só para testes: limpa o cache em memória. */
export function _resetMemCache() {
  memCache.clear()
}

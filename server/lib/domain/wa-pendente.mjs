import { getRedis } from '../redis-shared.mjs'
import { log } from '../logger.mjs'

/**
 * Pergunta PENDENTE do bot por telefone (T2 — desambiguação seletiva).
 * Ex.: "qual lista? responda 1 ou 2". TTL curto (5 min): a resposta numérica
 * só é interpretada logo após a pergunta — depois disso dígitos voltam a valer
 * para o menu de lembrete da agenda.
 */

const TTL_SECONDS = 5 * 60

const memStore = new Map() // fallback sem Redis: key → { expiresAt, data }

function chave(phone) {
  return `wa:pend:${String(phone || '').replace(/\D/g, '')}`
}

export async function setPendente(phone, data) {
  const key = chave(phone)
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(data), 'EX', TTL_SECONDS)
      return
    } catch (e) {
      log.warn('[wa-pendente] redis set error', e?.message)
    }
  }
  if (memStore.size > 2000) memStore.clear()
  memStore.set(key, { expiresAt: Date.now() + TTL_SECONDS * 1000, data })
}

export async function getPendente(phone) {
  const key = chave(phone)
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get(key)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      log.warn('[wa-pendente] redis get error', e?.message)
    }
  }
  const hit = memStore.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    memStore.delete(key)
    return null
  }
  return hit.data
}

export async function clearPendente(phone) {
  const key = chave(phone)
  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(key)
      return
    } catch (e) {
      log.warn('[wa-pendente] redis del error', e?.message)
    }
  }
  memStore.delete(key)
}

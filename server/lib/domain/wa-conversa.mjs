import { getRedis } from '../redis-shared.mjs'
import { log } from '../logger.mjs'

/**
 * Memória conversacional CURTA do bot WhatsApp (T1 do plano de IA).
 * Guarda as últimas trocas por telefone (Redis, TTL 15 min, fallback memória)
 * no formato Gemini contents ({role:'user'|'model', parts:[{text}]}) — o mesmo
 * que askHorizon consome. Não é histórico permanente: é contexto de sessão
 * para follow-ups ("e ontem?", "quanto foi mesmo?").
 */

const TTL_SECONDS = 15 * 60
const MAX_MENSAGENS = 12 // 6 trocas user+model

const memStore = new Map() // fallback sem Redis: key → { expiresAt, itens }

function chave(phone) {
  return `wa:hist:${String(phone || '').replace(/\D/g, '')}`
}

function memGet(key) {
  const hit = memStore.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    memStore.delete(key)
    return null
  }
  return hit.itens
}

function memSet(key, itens) {
  // teto simples para não crescer sem limite em processo longo
  if (memStore.size > 2000) memStore.clear()
  memStore.set(key, { expiresAt: Date.now() + TTL_SECONDS * 1000, itens })
}

/** @returns {Promise<Array<{role:'user'|'model', parts:[{text:string}]}>>} */
export async function lerHistoricoConversa(phone) {
  const key = chave(phone)
  if (!key.endsWith(':')) {
    const redis = getRedis()
    if (redis) {
      try {
        const raw = await redis.get(key)
        if (raw) {
          const itens = JSON.parse(raw)
          if (Array.isArray(itens)) return itens
        }
        return []
      } catch (e) {
        log.warn('[wa-conversa] redis get error', e?.message)
      }
    }
    return memGet(key) || []
  }
  return []
}

/** Registra uma troca (mensagem do usuário + resposta do bot) e renova o TTL. */
export async function registrarTrocaConversa(phone, userText, botText) {
  const u = String(userText || '').trim().slice(0, 600)
  const b = String(botText || '').trim().slice(0, 600)
  if (!u && !b) return
  try {
    const anterior = await lerHistoricoConversa(phone)
    const itens = [...anterior]
    if (u) itens.push({ role: 'user', parts: [{ text: u }] })
    if (b) itens.push({ role: 'model', parts: [{ text: b }] })
    const recortado = itens.slice(-MAX_MENSAGENS)

    const key = chave(phone)
    const redis = getRedis()
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(recortado), 'EX', TTL_SECONDS)
        return
      } catch (e) {
        log.warn('[wa-conversa] redis set error', e?.message)
      }
    }
    memSet(key, recortado)
  } catch (e) {
    log.warn('[wa-conversa] registrarTrocaConversa error', e?.message)
  }
}

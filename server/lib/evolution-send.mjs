import { log } from './logger.mjs'

function firstString(...values) {
  for (const value of values) {
    const s = String(value || '').trim()
    if (s) return s
  }
  return ''
}

export function evolutionEnvConfigured() {
  const baseUrl = firstString(process.env.EVOLUTION_API_URL, process.env.EVOLUTION_SERVER_URL)
  const apiKey = firstString(process.env.EVOLUTION_API_KEY)
  const instance = firstString(process.env.EVOLUTION_INSTANCE)
  return Boolean(baseUrl && apiKey && instance)
}

/**
 * Envia texto via Evolution API (`/message/sendText/:instance`).
 * `number`: apenas dígitos (ex.: 5511999999999).
 */
export async function sendEvolutionText({ instance, number, text }) {
  const baseUrl = firstString(process.env.EVOLUTION_API_URL, process.env.EVOLUTION_SERVER_URL)
  const apiKey = firstString(process.env.EVOLUTION_API_KEY)
  if (!baseUrl || !apiKey || !instance || !number || !text) return false

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ number, text, delay: 1000 }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    log.warn('[evolution] sendText failed', { status: response.status, detail: detail.slice(0, 280) })
    return false
  }
  return true
}

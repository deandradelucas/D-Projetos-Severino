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
 * `number`: E.164 só dígitos (ex.: 5511999999999) — `createJid` acrescenta @s.whatsapp.net.
 * `remoteJid`: se definido (ex.: `...@lid` ou `...@s.whatsapp.net`), tem prioridade — necessário para chats só com LID.
 */
export async function sendEvolutionText({ instance, number, text, remoteJid }) {
  const baseUrl = firstString(process.env.EVOLUTION_API_URL, process.env.EVOLUTION_SERVER_URL)
  const apiKey = firstString(process.env.EVOLUTION_API_KEY)
  const dest = firstString(remoteJid, number)
  if (!baseUrl || !apiKey || !instance || !dest || !text) return false

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ number: dest, text, delay: 1000 }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    log.warn('[evolution] sendText failed', { status: response.status, detail: detail.slice(0, 280) })
    return false
  }
  return true
}

/**
 * Envia mensagem com botões de resposta rápida via Evolution API (`/message/sendButtons/:instance`).
 * Máximo 3 botões. Resposta vem como `buttonsResponseMessage.selectedButtonId`.
 * Normaliza internamente para o formato Evolution v2: { type, displayText, id }.
 */
export async function sendEvolutionButtons({ instance, number, remoteJid, title, description, footer, buttons }) {
  const baseUrl = firstString(process.env.EVOLUTION_API_URL, process.env.EVOLUTION_SERVER_URL)
  const apiKey = firstString(process.env.EVOLUTION_API_KEY)
  const dest = firstString(remoteJid, number)
  if (!baseUrl || !apiKey || !instance || !dest || !buttons?.length) return false

  const payload = {
    number: dest,
    title,
    description,
    footer,
    buttons: buttons.map((b) => ({
      type: 'reply',
      displayText: String(b.buttonText?.displayText || b.displayText || ''),
      id: String(b.buttonId || b.id || ''),
    })),
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/message/sendButtons/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    log.warn('[evolution] sendButtons failed', { status: response.status, detail: detail.slice(0, 280) })
    return false
  }
  return true
}

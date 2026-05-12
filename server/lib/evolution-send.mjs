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
 * Envia mensagem de lista interativa via Evolution API (`/message/sendList/:instance`).
 * O usuário vê um botão que abre uma lista de opções clicáveis (sem precisar digitar).
 * `sections`: [{ title, rows: [{ title, description, rowId }] }]
 */
export async function sendEvolutionList({ instance, number, remoteJid, title, description, buttonText, footerText, sections }) {
  const baseUrl = firstString(process.env.EVOLUTION_API_URL, process.env.EVOLUTION_SERVER_URL)
  const apiKey = firstString(process.env.EVOLUTION_API_KEY)
  const dest = firstString(remoteJid, number)
  if (!baseUrl || !apiKey || !instance || !dest || !sections?.length) return false

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/message/sendList/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ number: dest, title, description, buttonText, footerText, sections }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    log.warn('[evolution] sendList failed', { status: response.status, detail: detail.slice(0, 280) })
    return false
  }
  return true
}

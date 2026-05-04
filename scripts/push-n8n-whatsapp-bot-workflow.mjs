/**
 * Atualiza o workflow "WhatsApp Bot — Horizonte Financeiro" no n8n via API.
 * Uso na raiz do repo: `node --env-file=.env scripts/push-n8n-whatsapp-bot-workflow.mjs`
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=\s]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const baseUrl = String(process.env.N8N_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '')
const apiKey = String(process.env.N8N_API_KEY || '').trim()
const workflowId = process.env.N8N_WHATSAPP_WORKFLOW_ID || 'DkQwK32vP90rTbOY'

if (!baseUrl || !apiKey) {
  console.error('Defina N8N_BASE_URL e N8N_API_KEY.')
  process.exit(1)
}

const extrairCode = `const root = $json.body || $json;
const data = root.data || {};
const key = data.key || {};
const remoteJid = String(key.remoteJid || '');

if (remoteJid.endsWith('@g.us')) return [];

const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\\D/g, '');
const instance = String(root.instance || data.instance || '').trim();
const msg = data.message || {};
const audio = msg.audioMessage || msg.pttMessage || {};
const messageId = String(key.id || data.id || '').trim();
const text = (
  msg.conversation ||
  msg.extendedTextMessage?.text ||
  msg.imageMessage?.caption ||
  msg.videoMessage?.caption ||
  audio.caption ||
  audio.transcription ||
  audio.text ||
  data.transcription ||
  ''
).trim();

const audioUrl = String(audio.url || audio.mediaUrl || audio.media_url || data.mediaUrl || data.audioUrl || data.url || '').trim();
const audioBase64 = String(audio.base64 || data.base64 || data.audioBase64 || '').trim();
const mimeType = String(audio.mimetype || audio.mimeType || data.mimetype || data.mimeType || 'audio/ogg');
const hasAudio = Boolean(audioUrl || audioBase64 || (messageId && (msg.audioMessage || msg.pttMessage)));

if (!text && !hasAudio) return [];

return [{ json: { phone, message: text, remoteJid, instance, audioUrl, audioBase64, mimeType, messageId, evolutionInstance: instance } }];`

const processarJsonBody = `={{ JSON.stringify({
  phone: $json.phone,
  message: $json.message,
  audioUrl: $json.audioUrl,
  audioBase64: $json.audioBase64,
  mimeType: $json.mimeType,
  messageId: $json.messageId,
  evolutionInstance: $json.evolutionInstance || $json.instance,
  instance: $json.instance,
}) }}`

const montarEnvioCode = `const backendResp = $json;
const extractedItem = $('Extrair telefone e mensagem').first();
const remoteJid = extractedItem?.json?.remoteJid || '';
const instance = extractedItem?.json?.instance || '';

if (backendResp?.whatsappOutboundSent) return [];

const textToSend = String(backendResp?.reply || '').trim() || String(backendResp?.whatsappFallbackText || '').trim();
if (!textToSend || !remoteJid || !instance) return [];

return [{ json: { remoteJid, instance, reply: textToSend } }];`

async function main() {
  const getUrl = `${baseUrl}/api/v1/workflows/${workflowId}`
  const res = await fetch(getUrl, {
    headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
  })
  if (!res.ok) {
    console.error('GET workflow failed', res.status, await res.text())
    process.exit(1)
  }
  const wf = await res.json()

  for (const node of wf.nodes || []) {
    if (node.name === 'Extrair telefone e mensagem') {
      node.parameters = node.parameters || {}
      node.parameters.jsCode = extrairCode
    }
    if (node.name === 'Processar no Horizonte') {
      node.parameters = node.parameters || {}
      node.parameters.jsonBody = processarJsonBody
    }
    if (node.name === 'Montar envio') {
      node.parameters = node.parameters || {}
      node.parameters.jsCode = montarEnvioCode
    }
  }

  const body = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings,
    staticData: wf.staticData,
  }

  const putRes = await fetch(getUrl, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const putText = await putRes.text()
  if (!putRes.ok) {
    console.error('PUT workflow failed', putRes.status, putText.slice(0, 2000))
    process.exit(1)
  }
  console.log('Workflow atualizado:', workflowId, putRes.status)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

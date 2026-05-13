/**
 * Atualiza o workflow "WhatsApp Bot — Horizonte Financeiro" no n8n via API.
 *
 * Env (N8N_BASE_URL, N8N_API_KEY, opcional N8N_WHATSAPP_WORKFLOW_ID):
 *   - Sem `--env-file`: **mescla** na raiz do repo (último ganha), como Vite — evita `.production.local`
 *     com chave antiga ignorar o que está em `.env.production`:
 *     `.env` → `.env.local` → `.env.production` → `.env.production.local`
 *     Valores vazios num ficheiro **não** apagam a chave já definida antes.
 *   - `--env-file=caminho`: só esse ficheiro (substitui a mescla).
 *   - `ENV_FILE` / `N8N_PUSH_ENV_FILE`: idem `--env-file`.
 *
 * Exemplos (na raiz do repo):
 *   npm run n8n:push
 *   node scripts/push-n8n-whatsapp-bot-workflow.mjs --env-file=.env
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

function parseEnvFileCliArg() {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--help' || a === '-h') return '__help__'
    if (a.startsWith('--env-file=')) return a.slice('--env-file='.length).trim()
    if (a === '--env-file' && args[i + 1]) return args[i + 1].trim()
  }
  const fromEnv = String(process.env.N8N_PUSH_ENV_FILE || process.env.ENV_FILE || '').trim()
  return fromEnv || null
}

/** Ordem de mescla (último ficheiro prevalece por chave). Igual ao Vite. */
const DEFAULT_ENV_MERGE_CHAIN = ['.env', '.env.local', '.env.production', '.env.production.local']

function unquoteEnvValue(raw) {
  let v = String(raw ?? '').trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  return v
}

/** Aplica KEY=VAL; se VAL vazio após trim, não altera (não apaga chave vinda de ficheiro anterior). */
function loadDotEnvMerge(envPath) {
  if (!existsSync(envPath)) return false
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=\s]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const value = unquoteEnvValue(m[2])
    if (value === '') continue
    process.env[key] = value
  }
  return true
}

function resolveEnvPath(spec) {
  const s = String(spec || '').trim()
  if (!s) return null
  return isAbsolute(s) ? s : resolve(process.cwd(), s)
}

/** Carrega um único ficheiro (todos os KEY=VAL, inclusive vazios). */
function loadDotEnvFileStrict(envPath) {
  if (!existsSync(envPath)) {
    console.error(`Ficheiro de ambiente não encontrado: ${envPath}`)
    process.exit(1)
  }
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=\s]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = unquoteEnvValue(m[2])
  }
}

const cliEnvSpec = parseEnvFileCliArg()
if (cliEnvSpec === '__help__') {
  console.log(`Uso: node scripts/push-n8n-whatsapp-bot-workflow.mjs [--env-file=<ficheiro>]
       npm run n8n:push

  Sem flags: mescla ${DEFAULT_ENV_MERGE_CHAIN.join(' → ')}

  --env-file caminho    Só esse ficheiro
  ENV_FILE / N8N_PUSH_ENV_FILE   Idem --env-file
`)
  process.exit(0)
}

let envSummary = ''
if (cliEnvSpec) {
  const envPath = resolveEnvPath(cliEnvSpec)
  loadDotEnvFileStrict(envPath)
  envSummary = relative(process.cwd(), envPath) || envPath
  console.log('Env (ficheiro único):', envSummary)
} else {
  const loaded = []
  for (const name of DEFAULT_ENV_MERGE_CHAIN) {
    const p = join(repoRoot, name)
    if (loadDotEnvMerge(p)) loaded.push(name)
  }
  if (loaded.length === 0) {
    console.error(
      `Nenhum ficheiro .env na raiz do repo. Crie pelo menos um: ${DEFAULT_ENV_MERGE_CHAIN.join(', ')}`
    )
    process.exit(1)
  }
  envSummary = loaded.join(' + ')
  console.log('Env mesclado:', envSummary)
}

const baseUrl = String(process.env.N8N_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '')
const apiKey = String(process.env.N8N_API_KEY || '').trim()
const workflowId = process.env.N8N_WHATSAPP_WORKFLOW_ID || 'DkQwK32vP90rTbOY'

if (!baseUrl || !apiKey) {
  console.error(
    `N8N_BASE_URL e N8N_API_KEY são obrigatórios após carregar: ${envSummary}\n` +
      'Defina-as em .env.production ou .env (ou use --env-file=...).'
  )
  process.exit(1)
}

const extrairCode = `const root = $json.body || $json;
let data = root.data || {};
if (Array.isArray(data) && data.length) {
  data = data[0] || {};
} else if (data && Array.isArray(data.messages) && data.messages.length) {
  data = data.messages[0];
} else if (data && data.data && typeof data.data === 'object') {
  const inner = data.data;
  if (Array.isArray(inner.messages) && inner.messages.length) {
    data = inner.messages[0];
  } else if (inner.key) {
    data = inner;
  }
}
const key = data.key || {};
const remoteJid = String(key.remoteJid || '');
const remoteJidAlt = String(key.remoteJidAlt || key.remoteJid_alt || '');

if (remoteJid.endsWith('@g.us')) return [];

const phone = (remoteJid.endsWith('@lid') && remoteJidAlt)
  ? String((remoteJidAlt || '').split('@')[0] || '').replace(/\\D/g, '')
  : String((remoteJid || '').split('@')[0] || '').replace(/\\D/g, '');
const instance = String(root.instance || data.instance || '').trim();
const wrapNames = ['ephemeralMessage','documentWithCaptionMessage','viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension','editedMessage'];
let rawMsg = data.message || {};
for (let d = 0; d < 16; d++) {
  let inner = null;
  for (const w of wrapNames) {
    const m = rawMsg[w]?.message;
    if (m && typeof m === 'object') { inner = m; break; }
  }
  if (!inner) break;
  rawMsg = inner;
}
const msg = rawMsg;
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

return [{ json: { phone, message: text, remoteJid, remoteJidAlt, instance, audioUrl, audioBase64, mimeType, messageId, evolutionInstance: instance, rawEvolutionData: { data } } }];`

const processarJsonBody = `={{ JSON.stringify({
  phone: $json.phone,
  remoteJid: $json.remoteJid,
  remoteJidAlt: $json.remoteJidAlt,
  message: $json.message,
  audioUrl: $json.audioUrl,
  audioBase64: $json.audioBase64,
  mimeType: $json.mimeType,
  messageId: $json.messageId,
  evolutionInstance: $json.evolutionInstance || $json.instance,
  instance: $json.instance,
  rawEvolutionData: $json.rawEvolutionData,
}) }}`

const montarEnvioCode = `const backendResp = $json;
const extractedItem = $('Extrair telefone e mensagem').first();
const remoteJid = extractedItem?.json?.remoteJid || '';
const instance = extractedItem?.json?.instance || '';

if (backendResp?.whatsappOutboundSent) return [];

const textToSend = String(backendResp?.reply || '').trim();
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

  const verify = await fetch(getUrl, {
    headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
  })
  if (!verify.ok) {
    console.warn('Aviso: não foi possível re-ler o workflow para verificação.', verify.status)
    return
  }
  const wf2 = await verify.json()
  const extrair = (wf2.nodes || []).find((n) => n.name === 'Extrair telefone e mensagem')
  const proc = (wf2.nodes || []).find((n) => n.name === 'Processar no Horizonte')
  const js = extrair?.parameters?.jsCode || ''
  const jb = proc?.parameters?.jsonBody || ''
  const okRemote = js.includes('remoteJid') && jb.includes('remoteJid')
  const okPhone = js.includes("split('@')[0]")
  if (okRemote && okPhone) {
    console.log('Verificação: nós "Extrair…" / "Processar…" contêm remoteJid e telefone por JID.')
  } else {
    console.warn(
      'Verificação: renomeie os nós no n8n para "Extrair telefone e mensagem" e "Processar no Horizonte" ou ajuste o script.'
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

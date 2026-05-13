#!/usr/bin/env node
/**
 * Verifica GEMINI_API_KEY com um generateContent mínimo (só texto).
 * Não imprime a chave. Útil para distinguir chave/quota de problema só em áudio.
 *
 * Uso: npm run check:gemini
 * (carrega server/lib/load-env.mjs → .env e .env.local na raiz do repo)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import '../server/lib/load-env.mjs'
import {
  geminiPostGenerateContent,
  resolveGeminiModelCandidates,
} from '../server/lib/ai/gemini-client.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Ficheiros na raiz que declaram GEMINI_API_KEY= (sem mostrar o valor). */
function filesDeclaringGeminiKey() {
  const candidates = ['.env', '.env.local', '.env.production', '.env.production.local']
  const hit = []
  for (const name of candidates) {
    const fp = path.join(root, name)
    if (!fs.existsSync(fp)) continue
    for (const line of fs.readFileSync(fp, 'utf8').split(/\r?\n/)) {
      const t = line.trim()
      if (t && !t.startsWith('#') && t.startsWith('GEMINI_API_KEY=')) {
        hit.push(name)
        break
      }
    }
  }
  return hit
}

const declaredIn = filesDeclaringGeminiKey()
if (declaredIn.length) {
  console.error(`GEMINI_API_KEY aparece em: ${declaredIn.join(', ')}`)
  console.error(
    'A API local (node server/index.mjs) só carrega .env e depois .env.local — a chave efetiva é a do .env.local se existir.',
  )
  if (declaredIn.includes('.env.production.local') || declaredIn.includes('.env.production')) {
    console.error(
      'Nota: .env.production / .env.production.local não são carregados pelo servidor Node; só pelo script n8n:push. Para dev local, use .env ou .env.local.',
    )
  }
  console.error('')
}

const key = String(process.env.GEMINI_API_KEY || '').trim()
if (!key) {
  console.error('GEMINI_API_KEY não definida no processo após load-env. Defina em .env ou .env.local.')
  process.exit(1)
}

console.error(`Chave carregada: ${key.length} caracteres (só comprimento, sem valor).\n`)

const body = {
  contents: [{ role: 'user', parts: [{ text: 'Responde exatamente com a palavra: OK' }] }],
  generationConfig: { maxOutputTokens: 16, temperature: 0 },
}

const models = resolveGeminiModelCandidates()
let lastFail = ''

for (const model of models) {
  const res = await geminiPostGenerateContent(model, key, body)
  const raw = await res.text()
  if (res.ok) {
    let snippet = raw.slice(0, 120)
    try {
      const j = JSON.parse(raw)
      const parts = j?.candidates?.[0]?.content?.parts
      if (Array.isArray(parts)) {
        snippet = parts.map((p) => p?.text || '').join('').trim() || snippet
      }
    } catch {
      /* manter raw */
    }
    console.log(`Sucesso: modelo=${model} HTTP ${res.status}`)
    console.log(`Trecho da resposta: ${snippet}`)
    process.exit(0)
  }
  lastFail = `modelo=${model} HTTP ${res.status} ${raw.slice(0, 400)}`
  console.error(`Falhou: ${lastFail}`)
  if (res.status === 401) process.exit(1)
  if (res.status === 404) continue
  /* 400 (chave inválida/expirada), 403, 429: tenta o próximo modelo por consistência com o runtime */
}

console.error('\nNenhum modelo respondeu com sucesso.')
if (/API key expired|API_KEY_INVALID|leaked|PERMISSION_DENIED/i.test(lastFail)) {
  console.error(
    '→ Atualize ou remova GEMINI_API_KEY em .env.local (sobrescreve .env). Gere chave nova em https://aistudio.google.com/app/apikey',
  )
}
process.exit(1)

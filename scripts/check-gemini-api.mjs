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
import { extractTextFromGeminiResponse } from '../server/lib/ai/parsers.mjs'
import {
  buildGeminiGenerationConfig,
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

async function main() {
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
    process.exitCode = 1
    return
  }

  console.error(`Chave carregada: ${key.length} caracteres (só comprimento, sem valor).\n`)

  const models = resolveGeminiModelCandidates()
  let lastFail = ''

  const tests = [
    {
      label: 'texto simples',
      buildBody: (model) => ({
        contents: [{ role: 'user', parts: [{ text: 'Responde exatamente com a palavra: OK' }] }],
        generationConfig: buildGeminiGenerationConfig(model, { maxOutputTokens: 64, temperature: 0 }),
      }),
    },
    {
      label: 'chat (systemInstruction)',
      buildBody: (model) => ({
        systemInstruction: { parts: [{ text: 'Responda apenas com a palavra OK.' }] },
        contents: [{ role: 'user', parts: [{ text: 'Olá' }] }],
        generationConfig: buildGeminiGenerationConfig(model, { maxOutputTokens: 128, temperature: 0.7 }),
      }),
    },
  ]

  let allPassed = true

  for (const { label, buildBody } of tests) {
    console.error(`--- Teste: ${label} ---`)
    let testPassed = false

    for (const model of models) {
      const body = buildBody(model)
      const res = await geminiPostGenerateContent(model, key, body)
      const raw = await res.text()

      if (!res.ok) {
        lastFail = `[${label}] modelo=${model} HTTP ${res.status} ${raw.slice(0, 400)}`
        console.error(`Falhou: ${lastFail}`)
        if (res.status === 401) {
          process.exitCode = 1
          return
        }
        continue
      }

      let json = {}
      try {
        json = raw ? JSON.parse(raw) : {}
      } catch {
        lastFail = `[${label}] modelo=${model} HTTP ${res.status} JSON inválido`
        console.error(`Falhou: ${lastFail}`)
        continue
      }

      const extracted = extractTextFromGeminiResponse(json)
      if (extracted.ok && extracted.text) {
        console.log(`Sucesso (${label}): modelo=${model} HTTP ${res.status}`)
        console.log(`Texto da resposta: ${extracted.text.slice(0, 120)}`)
        testPassed = true
        break
      }

      const detail = extracted.detail || json?.candidates?.[0]?.finishReason || 'sem detalhe'
      lastFail = `[${label}] modelo=${model} HTTP ${res.status} resposta sem texto (${extracted.kind}: ${detail})`
      console.error(`Falhou: ${lastFail}`)
    }

    if (!testPassed) allPassed = false
    console.error('')
  }

  if (allPassed) {
    console.log('Todos os testes passaram.')
    process.exitCode = 0
    return
  }

  console.error('\nPelo menos um teste falhou em todos os modelos candidatos.')
  if (/API key expired|API_KEY_INVALID|leaked|PERMISSION_DENIED/i.test(lastFail)) {
    console.error(
      '→ Atualize ou remova GEMINI_API_KEY em .env.local (sobrescreve .env). Gere chave nova em https://aistudio.google.com/app/apikey',
    )
  }
  if (/empty_text|MAX_TOKENS/i.test(lastFail)) {
    console.error(
      '→ A API respondeu 200 mas sem texto. Tente GEMINI_MODEL=gemini-2.0-flash no .env ou confira quota em Google AI Studio.',
    )
  }
  process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

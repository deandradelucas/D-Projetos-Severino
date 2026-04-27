import { loadEnv } from '../load-env.mjs'

const GEMINI_MODEL_FALLBACKS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash']
const DEFAULT_MODEL = 'gemini-2.0-flash'

/**
 * Resolve a lista de modelos candidatos baseada no .env e fallbacks.
 */
export function resolveGeminiModelCandidates() {
  loadEnv()
  const envModel = process.env.GEMINI_MODEL?.trim()
  const list = [envModel, ...GEMINI_MODEL_FALLBACKS].filter(Boolean)
  return [...new Set(list)]
}

/**
 * POST generateContent com autenticação recomendada pela Google.
 */
export async function geminiPostGenerateContent(modelId, apiKey, body) {
  const id = encodeURIComponent(String(modelId || DEFAULT_MODEL).trim() || DEFAULT_MODEL)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`
  
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': String(apiKey).trim(),
    },
    body: JSON.stringify(body),
  })
}

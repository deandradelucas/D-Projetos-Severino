import '../load-env.mjs'

/**
 * Apenas modelos atuais com cota free tier ativa (verificado jun/2026).
 * Removidos: gemini-2.0-flash (limit 0 em contas free novas) e gemini-1.5-flash (404, descontinuado).
 * Todos suportam entrada de áudio (necessário para transcrição via WhatsApp).
 * Em 2.5+/flash-latest use buildGeminiGenerationConfig (thinkingBudget: 0) — senão a resposta pode vir vazia.
 */
const GEMINI_MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']
const DEFAULT_MODEL = 'gemini-2.5-flash'

/** Modelos com thinking ativo por defeito (tokens de raciocínio contam no orçamento de saída). */
export function modelUsesThinkingBudget(modelId) {
  const id = String(modelId || '').toLowerCase()
  return /gemini-2\.5|gemini-3|flash-latest|thinking/.test(id)
}

/**
 * generationConfig seguro por modelo.
 * - Modelos 2.5+ têm thinking ativo por padrão; se overrides não trouxer thinkingConfig,
 *   aplica budget = 0 (resposta imediata). Passe thinkingConfig nos overrides para ativar.
 */
export function buildGeminiGenerationConfig(modelId, overrides = {}) {
  const config = { ...overrides }
  if (modelUsesThinkingBudget(modelId) && config.thinkingConfig === undefined) {
    config.thinkingConfig = { thinkingBudget: 0 }
  }
  return config
}

/**
 * Resolve a lista de modelos candidatos baseada no .env e fallbacks.
 */
export function resolveGeminiModelCandidates() {
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

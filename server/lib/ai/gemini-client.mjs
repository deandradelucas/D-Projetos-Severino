import '../load-env.mjs'

/**
 * Ordem: 2.5 primeiro (chaves novas); 2.0 só para contas legadas.
 * Em 2.5+ use buildGeminiGenerationConfig (thinkingBudget: 0) — senão a resposta pode vir vazia.
 */
const GEMINI_MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
const DEFAULT_MODEL = 'gemini-2.0-flash'

/** Modelos com thinking ativo por defeito (tokens de raciocínio contam no orçamento de saída). */
export function modelUsesThinkingBudget(modelId) {
  const id = String(modelId || '').toLowerCase()
  return /gemini-2\.5|gemini-3|thinking/.test(id)
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

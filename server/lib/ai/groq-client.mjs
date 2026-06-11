const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
// Modelos open hospedados no Groq (inferência grátis, OpenAI-compatible). Jun/2026.
// Fallback de TEXTO apenas — quando o Gemini falha por erro HTTP.
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

/**
 * Chama a API do Groq (OpenAI-compatible) e retorna o texto bruto da resposta.
 * Tenta modelos em ordem até um funcionar.
 */
export async function groqChatCompletion({ apiKey, systemPrompt, userMessage, maxTokens = 700, temperature = 0.15 }) {
  let lastErr = null

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      })

      if (!res.ok) {
        const t = await res.text()
        lastErr = new Error(`Groq ${model} ${res.status}: ${t.slice(0, 200)}`)
        if (res.status === 401) throw lastErr
        continue
      }

      const json = await res.json()
      return json?.choices?.[0]?.message?.content ?? ''
    } catch (e) {
      if (String(e?.message).includes('401')) throw e
      lastErr = e
    }
  }

  throw lastErr || new Error('Groq: todos os modelos falharam')
}

/**
 * Transcreve áudio via Groq Whisper (Story F1 — fallback quando o Gemini de
 * áudio falha). Retorna o texto transcrito; o caller segue pelo pipeline de
 * texto (que tem cache + fallback Groq). Modelo turbo: rápido e free.
 * @param {{ apiKey: string, audio: Buffer, filename?: string, mime?: string }} opts
 */
export async function groqTranscribeAudio({ apiKey, audio, filename = 'audio.ogg', mime = 'audio/ogg' }) {
  const form = new FormData()
  form.append('file', new Blob([audio], { type: mime }), filename)
  form.append('model', 'whisper-large-v3-turbo')
  form.append('language', 'pt')
  form.append('response_format', 'text')

  const res = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Groq Whisper ${res.status}: ${t.slice(0, 200)}`)
  }
  return (await res.text()).trim()
}

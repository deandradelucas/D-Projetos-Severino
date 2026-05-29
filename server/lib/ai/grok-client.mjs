const GROK_BASE_URL = 'https://api.x.ai/v1'
const GROK_MODELS = ['grok-3-mini-fast', 'grok-3-mini', 'grok-2-1212']

/**
 * Chama a API do Grok (OpenAI-compatible) e retorna o texto bruto da resposta.
 * Tenta modelos em ordem até um funcionar.
 */
export async function grokChatCompletion({ apiKey, systemPrompt, userMessage, maxTokens = 700, temperature = 0.15 }) {
  let lastErr = null

  for (const model of GROK_MODELS) {
    try {
      const res = await fetch(`${GROK_BASE_URL}/chat/completions`, {
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
        lastErr = new Error(`Grok ${model} ${res.status}: ${t.slice(0, 200)}`)
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

  throw lastErr || new Error('Grok: todos os modelos falharam')
}

import './load-env.mjs'
import { geminiPostGenerateContent, resolveGeminiModelCandidates } from './ai/gemini-client.mjs'
import { extractTextFromGeminiResponse } from './ai/parsers.mjs'

/**
 * Fallback: Gemini compara dígitos do webhook (LID/ruído) com telefones cadastrados no Supabase.
 */
export async function resolverUsuarioIdPorTelefoneGemini(digitosWebhook, usuarios) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || !digitosWebhook || !usuarios?.length) return null

  const digitos = String(digitosWebhook).replace(/\D/g, '')
  const listaUser = usuarios
    .filter(u => u.telefone)
    .map(u => `ID: ${u.id} | Email: ${u.email} | Telefone: ${u.telefone}`)
    .join('\n')

  const prompt = `Recebi uma mensagem do WhatsApp do número "${digitos}".
Abaixo está a lista de usuários cadastrados no sistema:
${listaUser}

Qual usuário da lista acima é o dono desse número? Considere que números do WhatsApp podem ter o DDI 55, o nono dígito (9) ou ser um LID (ex: 555499...).
Responda APENAS o UUID do usuário. Se não houver certeza absoluta, responda "null".`

  const models = resolveGeminiModelCandidates()
  for (const mid of models) {
    try {
      const response = await geminiPostGenerateContent(mid, apiKey, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
      })
      if (!response.ok) continue
      const json = await response.json()
      const extracted = extractTextFromGeminiResponse(json)
      if (extracted.ok) {
        const val = extracted.text.trim()
        if (val === 'null' || val.length < 10) return null
        return val
      }
    } catch {
      continue
    }
  }
  return null
}

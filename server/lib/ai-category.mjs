import './load-env.mjs'
import {
  geminiPostGenerateContent,
  resolveGeminiModelCandidates,
} from './ai/gemini-client.mjs'
import { tryParseJsonBlock } from './ai/parsers.mjs'
import { enriquecerCategoriaPorTexto } from './domain/transaction-heuristics.mjs'

/**
 * Sugere categoria e subcategoria para uma transação a partir da descrição.
 * Tenta heurísticas locais primeiro; Gemini só como fallback.
 */
export async function suggestCategoryForTransaction(descricao, tipo, categoriasUsuario) {
  const texto = String(descricao || '').trim()
  if (!texto || texto.length < 2) return { categoria_id: null, subcategoria_id: null }

  // Passo 1: heurísticas locais — zero custo de API
  const fakeExtracted = { tipo, categoria_id: null, subcategoria_id: null }
  const enriched = enriquecerCategoriaPorTexto(texto, fakeExtracted, categoriasUsuario)
  if (enriched.categoria_id) {
    return { categoria_id: enriched.categoria_id, subcategoria_id: enriched.subcategoria_id ?? null }
  }

  // Passo 2: Gemini como fallback
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { categoria_id: null, subcategoria_id: null }

  const catsTipo = (categoriasUsuario || []).filter((c) => c.tipo === tipo)
  if (!catsTipo.length) return { categoria_id: null, subcategoria_id: null }

  const catMap = catsTipo
    .map((c) => {
      const subs = (c.subcategorias || []).slice(0, 10).map((s) => `${s.nome}[${s.id}]`).join(', ')
      return `${c.nome}(id:${c.id}) → ${subs}`
    })
    .join('\n')

  const prompt =
    `Categorize esta descrição de transação financeira em português brasileiro.\n` +
    `Tipo: ${tipo}\n` +
    `Descrição: "${texto}"\n\n` +
    `Categorias disponíveis:\n${catMap}\n\n` +
    `Retorne APENAS JSON válido (sem markdown):\n` +
    `{"categoria_id":"uuid","subcategoria_id":"uuid_ou_null"}\n` +
    `Se nenhuma categoria for adequada: {"categoria_id":null,"subcategoria_id":null}`

  const models = resolveGeminiModelCandidates()
  for (const mid of models) {
    try {
      const response = await geminiPostGenerateContent(mid, apiKey, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 100, temperature: 0.1 },
      })
      if (!response.ok) continue

      const json = await response.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const parsed = tryParseJsonBlock(text)
      if (!parsed || typeof parsed !== 'object') continue

      const cat = catsTipo.find((c) => c.id === parsed.categoria_id)
      if (!cat) return { categoria_id: null, subcategoria_id: null }

      const sub = parsed.subcategoria_id
        ? (cat.subcategorias || []).find((s) => s.id === parsed.subcategoria_id)
        : null

      return { categoria_id: cat.id, subcategoria_id: sub?.id ?? null }
    } catch {
      continue
    }
  }

  return { categoria_id: null, subcategoria_id: null }
}

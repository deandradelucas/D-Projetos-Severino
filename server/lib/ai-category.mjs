import './load-env.mjs'
import {
  buildGeminiGenerationConfig,
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
        generationConfig: buildGeminiGenerationConfig(mid, { maxOutputTokens: 100, temperature: 0.1 }),
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

/**
 * Categoriza um array de transações em uma única chamada Gemini.
 * Heurísticas rodam primeiro; Gemini só para o que sobrar.
 *
 * @param {Array<{descricao, tipo}>} rows
 * @param {Array} categoriasUsuario
 * @returns {Array<{categoria_id, subcategoria_id}>} — mesma ordem de rows
 */
export async function suggestCategoriesBatch(rows, categoriasUsuario) {
  if (!rows.length) return []

  // Passo 1: heurísticas para todas
  const results = rows.map((row) => {
    const texto = String(row.descricao || '').trim()
    if (!texto) return null
    const fake = { tipo: row.tipo, categoria_id: null, subcategoria_id: null }
    const enriched = enriquecerCategoriaPorTexto(texto, fake, categoriasUsuario)
    return enriched.categoria_id
      ? { categoria_id: enriched.categoria_id, subcategoria_id: enriched.subcategoria_id ?? null }
      : null
  })

  const pendentes = results.map((r, i) => r === null ? i : null).filter((i) => i !== null)
  if (!pendentes.length) return results.map((r) => r || { categoria_id: null, subcategoria_id: null })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    pendentes.forEach((i) => { results[i] = { categoria_id: null, subcategoria_id: null } })
    return results.map((r) => r || { categoria_id: null, subcategoria_id: null })
  }

  // Passo 2: uma única chamada Gemini para todos os pendentes (chunks de 50)
  const CHUNK = 50
  for (let start = 0; start < pendentes.length; start += CHUNK) {
    const chunk = pendentes.slice(start, start + CHUNK)

    const catMapDespesa = (categoriasUsuario || [])
      .filter((c) => c.tipo === 'DESPESA')
      .map((c) => {
        const subs = (c.subcategorias || []).slice(0, 8).map((s) => `${s.nome}[${s.id}]`).join(', ')
        return `${c.nome}(id:${c.id}) → ${subs}`
      }).join('\n')

    const catMapReceita = (categoriasUsuario || [])
      .filter((c) => c.tipo === 'RECEITA')
      .map((c) => {
        const subs = (c.subcategorias || []).slice(0, 8).map((s) => `${s.nome}[${s.id}]`).join(', ')
        return `${c.nome}(id:${c.id}) → ${subs}`
      }).join('\n')

    const txList = chunk.map((idx, pos) => `${pos}|${rows[idx].tipo}|"${String(rows[idx].descricao).trim()}"`).join('\n')

    const prompt =
      `Categorize estas transações financeiras em português brasileiro.\n\n` +
      `Transações (pos|tipo|descrição):\n${txList}\n\n` +
      `Categorias DESPESA:\n${catMapDespesa}\n\n` +
      `Categorias RECEITA:\n${catMapReceita}\n\n` +
      `Retorne APENAS um array JSON (sem markdown), um objeto por transação na mesma ordem:\n` +
      `[{"i":0,"categoria_id":"uuid","subcategoria_id":"uuid_ou_null"},...]\n` +
      `Use null em categoria_id e subcategoria_id se não houver categoria adequada.`

    const models = resolveGeminiModelCandidates()
    let batchParsed = null
    for (const mid of models) {
      try {
        const response = await geminiPostGenerateContent(mid, apiKey, {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: buildGeminiGenerationConfig(mid, { maxOutputTokens: 2048, temperature: 0.1 }),
        })
        if (!response.ok) continue
        const json = await response.json()
        const text = json?.candidates?.[0]?.content?.parts?.find((p) => !p.thought && p.text)?.text || ''
        const parsed = tryParseJsonBlock(text)
        if (Array.isArray(parsed)) { batchParsed = parsed; break }
      } catch { continue }
    }

    if (batchParsed) {
      for (const entry of batchParsed) {
        const pos = entry?.i
        if (typeof pos !== 'number' || pos < 0 || pos >= chunk.length) continue
        const originalIdx = chunk[pos]
        const tipo = rows[originalIdx].tipo
        const cat = (categoriasUsuario || []).find((c) => c.id === entry.categoria_id && c.tipo === tipo)
        if (!cat) { results[originalIdx] = { categoria_id: null, subcategoria_id: null }; continue }
        const sub = entry.subcategoria_id
          ? (cat.subcategorias || []).find((s) => s.id === entry.subcategoria_id)
          : null
        results[originalIdx] = { categoria_id: cat.id, subcategoria_id: sub?.id ?? null }
      }
    }

    // preenche qualquer pendente que o Gemini não respondeu
    chunk.forEach((originalIdx) => {
      if (results[originalIdx] === null) results[originalIdx] = { categoria_id: null, subcategoria_id: null }
    })
  }

  return results.map((r) => r || { categoria_id: null, subcategoria_id: null })
}

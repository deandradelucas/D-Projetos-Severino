import './load-env.mjs'
import {
  buildGeminiGenerationConfig,
  geminiPostGenerateContent,
  resolveGeminiModelCandidates,
} from './ai/gemini-client.mjs'
import { tryParseJsonBlock } from './ai/parsers.mjs'
import { enriquecerCategoriaPorTexto } from './domain/transaction-heuristics.mjs'
import { resolverCategoriaPorCorrecao } from './domain/transacao-categoria-logger.mjs'
import { groqChatCompletion } from './ai/groq-client.mjs'
import { aiCacheKey, aiCacheGet, aiCacheSet, AI_CACHE_TTL } from './ai/ai-cache.mjs'
import { recordAiCall, recordCache } from './ai/ai-telemetry.mjs'

/** Monta hash estável das categorias do usuário para chave de cache. */
function hashCategorias(categoriasUsuario) {
  return (categoriasUsuario || []).map((c) => c.id).sort().join(',')
}

/**
 * Valida e extrai categoria/subcategoria do JSON parseado contra a lista do usuário.
 */
function validateCatResult(parsed, catsTipo) {
  if (!parsed || typeof parsed !== 'object') return null
  const cat = catsTipo.find((c) => c.id === parsed.categoria_id)
  if (!cat) return { categoria_id: null, subcategoria_id: null }
  const sub = parsed.subcategoria_id
    ? (cat.subcategorias || []).find((s) => s.id === parsed.subcategoria_id)
    : null
  return { categoria_id: cat.id, subcategoria_id: sub?.id ?? null }
}

/**
 * Sugere categoria e subcategoria para uma transação a partir da descrição.
 * Tenta heurísticas locais primeiro; Gemini só como fallback.
 */
export async function suggestCategoryForTransaction(descricao, tipo, categoriasUsuario, usuarioId = null) {
  const texto = String(descricao || '').trim()
  if (!texto || texto.length < 2) return { categoria_id: null, subcategoria_id: null }

  // Passo 0: memória de comerciante — se o usuário já corrigiu uma descrição
  // parecida (mesmo comerciante/tipo), a escolha dele vence o LLM.
  if (usuarioId) {
    try {
      const corr = await resolverCategoriaPorCorrecao(usuarioId, texto, categoriasUsuario, tipo)
      if (corr?.categoria_id) return corr
    } catch { /* best-effort */ }
  }

  // Passo 1: heurísticas locais — zero custo de API
  const fakeExtracted = { tipo, categoria_id: null, subcategoria_id: null }
  const enriched = enriquecerCategoriaPorTexto(texto, fakeExtracted, categoriasUsuario)
  if (enriched.categoria_id) {
    return { categoria_id: enriched.categoria_id, subcategoria_id: enriched.subcategoria_id ?? null }
  }

  // Passo 2: cache (chave: descricao normalizada + tipo + hash das categorias)
  const cacheKey = aiCacheKey('categoria', texto.toLowerCase(), tipo, hashCategorias(categoriasUsuario))
  try {
    const cached = await aiCacheGet(cacheKey)
    if (cached !== null) {
      recordCache(true)
      return cached
    }
    recordCache(false)
  } catch {
    // best-effort
  }

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
  let geminiOk = false
  for (const mid of models) {
    try {
      const response = await geminiPostGenerateContent(mid, apiKey, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: buildGeminiGenerationConfig(mid, { maxOutputTokens: 100, temperature: 0.1 }),
      })
      if (!response.ok) {
        recordAiCall('gemini', 'categoria', 'fail')
        continue
      }

      const json = await response.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const result = validateCatResult(tryParseJsonBlock(text), catsTipo)
      if (!result) {
        recordAiCall('gemini', 'categoria', 'fail')
        continue
      }

      recordAiCall('gemini', 'categoria', 'ok')
      geminiOk = true
      try { await aiCacheSet(cacheKey, result, AI_CACHE_TTL.categoria) } catch { /* noop */ }
      return result
    } catch {
      recordAiCall('gemini', 'categoria', 'fail')
      continue
    }
  }

  // Fallback Groq quando todos os modelos Gemini falharam
  if (!geminiOk) {
    const groqKey = process.env.GROQ_API_KEY
    if (groqKey) {
      try {
        const groqText = await groqChatCompletion({
          apiKey: groqKey,
          systemPrompt: 'Você categoriza transações financeiras em português. Retorne APENAS JSON válido.',
          userMessage: prompt,
          maxTokens: 100,
          temperature: 0.1,
        })
        const result = validateCatResult(tryParseJsonBlock(groqText), catsTipo)
        if (result) {
          recordAiCall('groq', 'categoria', 'ok')
          try { await aiCacheSet(cacheKey, result, AI_CACHE_TTL.categoria) } catch { /* noop */ }
          return result
        }
        recordAiCall('groq', 'categoria', 'fail')
      } catch {
        recordAiCall('groq', 'categoria', 'fail')
      }
    }
  }

  return { categoria_id: null, subcategoria_id: null }
}

/**
 * Categoriza um array de transações em uma única chamada Gemini.
 * Heurísticas rodam primeiro; cache item-a-item antes do chunk; Gemini só para o que sobrar.
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

  let pendentes = results.map((r, i) => r === null ? i : null).filter((i) => i !== null)
  if (!pendentes.length) return results.map((r) => r || { categoria_id: null, subcategoria_id: null })

  // Passo 2: cache item-a-item antes de qualquer chamada de API
  const catHash = hashCategorias(categoriasUsuario)
  const cacheHits = await Promise.all(
    pendentes.map(async (idx) => {
      const texto = String(rows[idx].descricao || '').trim().toLowerCase()
      const key = aiCacheKey('categoria', texto, rows[idx].tipo, catHash)
      try {
        const cached = await aiCacheGet(key)
        if (cached !== null) { recordCache(true); return { idx, result: cached, key } }
        recordCache(false)
      } catch { /* noop */ }
      return { idx, result: null, key }
    })
  )
  for (const { idx, result } of cacheHits) {
    if (result !== null) results[idx] = result
  }
  // Recalcula pendentes após cache hits
  pendentes = results.map((r, i) => r === null ? i : null).filter((i) => i !== null)
  if (!pendentes.length) return results.map((r) => r || { categoria_id: null, subcategoria_id: null })

  // Mapa key por índice para gravar cache após resposta da API
  const cacheKeyMap = Object.fromEntries(cacheHits.map(({ idx, key }) => [idx, key]))

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    pendentes.forEach((i) => { results[i] = { categoria_id: null, subcategoria_id: null } })
    return results.map((r) => r || { categoria_id: null, subcategoria_id: null })
  }

  // Passo 3: uma única chamada Gemini para todos os pendentes (chunks de 50)
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
    let geminiChunkOk = false
    for (const mid of models) {
      try {
        const response = await geminiPostGenerateContent(mid, apiKey, {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: buildGeminiGenerationConfig(mid, { maxOutputTokens: 2048, temperature: 0.1 }),
        })
        if (!response.ok) {
          recordAiCall('gemini', 'categoria', 'fail')
          continue
        }
        const json = await response.json()
        const text = json?.candidates?.[0]?.content?.parts?.find((p) => !p.thought && p.text)?.text || ''
        const parsed = tryParseJsonBlock(text)
        if (Array.isArray(parsed)) {
          batchParsed = parsed
          geminiChunkOk = true
          recordAiCall('gemini', 'categoria', 'ok')
          break
        }
        recordAiCall('gemini', 'categoria', 'fail')
      } catch {
        recordAiCall('gemini', 'categoria', 'fail')
        continue
      }
    }

    // Fallback Groq para o chunk quando Gemini falhou
    if (!geminiChunkOk) {
      const groqKey = process.env.GROQ_API_KEY
      if (groqKey) {
        try {
          const groqText = await groqChatCompletion({
            apiKey: groqKey,
            systemPrompt: 'Você categoriza transações financeiras em português. Retorne APENAS um array JSON válido, sem markdown.',
            userMessage: prompt,
            maxTokens: 2048,
            temperature: 0.1,
          })
          const parsed = tryParseJsonBlock(groqText)
          if (Array.isArray(parsed)) {
            batchParsed = parsed
            recordAiCall('groq', 'categoria', 'ok')
          } else {
            recordAiCall('groq', 'categoria', 'fail')
          }
        } catch {
          recordAiCall('groq', 'categoria', 'fail')
        }
      }
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
        const result = { categoria_id: cat.id, subcategoria_id: sub?.id ?? null }
        results[originalIdx] = result
        // Gravar cache por item
        try { await aiCacheSet(cacheKeyMap[originalIdx], result, AI_CACHE_TTL.categoria) } catch { /* noop */ }
      }
    }

    // preenche qualquer pendente que as APIs não responderam
    chunk.forEach((originalIdx) => {
      if (results[originalIdx] === null) results[originalIdx] = { categoria_id: null, subcategoria_id: null }
    })
  }

  return results.map((r) => r || { categoria_id: null, subcategoria_id: null })
}

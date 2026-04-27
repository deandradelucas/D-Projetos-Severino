/**
 * Normaliza MIME para inline_data do Gemini.
 */
export function normalizeAudioMimeForGemini(mimetype) {
  const s = String(mimetype || '')
    .toLowerCase()
    .split(';')[0]
    .trim()
  if (s.includes('ogg')) return 'audio/ogg'
  if (s.includes('mpeg') || s.endsWith('mp3')) return 'audio/mpeg'
  if (s.includes('mp4') || s.includes('m4a') || s.includes('aac')) return 'audio/mp4'
  if (s.includes('wav')) return 'audio/wav'
  if (s.includes('webm')) return 'audio/webm'
  return 'audio/ogg'
}

/**
 * Extrai texto da resposta generateContent e detecta bloqueios.
 */
export function extractTextFromGeminiResponse(json) {
  const blockReason = json?.promptFeedback?.blockReason
  if (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED') {
    return {
      ok: false,
      kind: 'prompt_blocked',
      detail: String(blockReason),
    }
  }
  const errMsg = json?.error?.message
  if (errMsg && !json?.candidates?.length) {
    return { ok: false, kind: 'api_error', detail: String(errMsg) }
  }
  const cand = json?.candidates?.[0]
  if (!cand) {
    return { ok: false, kind: 'no_candidate', detail: errMsg || 'empty_candidates' }
  }
  const parts = cand?.content?.parts
  let text = ''
  if (Array.isArray(parts)) {
    for (const p of parts) {
      if (p && typeof p.text === 'string') text += p.text
    }
  }
  text = text.trim()
  const fr = cand.finishReason
  if (text) {
    return { ok: true, text }
  }
  if (fr === 'SAFETY' || fr === 'BLOCKLIST' || fr === 'PROHIBITED_CONTENT') {
    return { ok: false, kind: 'response_blocked', detail: String(fr) }
  }
  return { ok: false, kind: 'empty_text', detail: fr || 'no_text' }
}

/**
 * Monta contents válidos para o Gemini a partir de um histórico.
 */
export function buildGeminiContents(historico, message) {
  const msg = String(message || '').trim()
  const turns = []
  for (const raw of Array.isArray(historico) ? historico.slice(-10) : []) {
    let role = raw?.role
    if (role === 'assistant') role = 'model'
    if (role !== 'user' && role !== 'model') continue
    const text = String(raw?.text ?? '').trim()
    if (!text) continue
    turns.push({ role, text })
  }
  if (msg) turns.push({ role: 'user', text: msg })

  const merged = []
  for (const t of turns) {
    const prev = merged[merged.length - 1]
    if (prev && prev.role === t.role) {
      prev.text = `${prev.text}\n${t.text}`.trim()
    } else {
      merged.push({ role: t.role, text: t.text })
    }
  }

  while (merged.length > 0 && merged[0].role === 'model') {
    merged.shift()
  }

  return merged.map((t) => ({ role: t.role, parts: [{ text: t.text }] }))
}

/**
 * Fallback para instruções de sistema quando não aceites como parâmetro raiz.
 */
export function contentsWithSystemPrepended(systemPrompt, contents) {
  const first = contents[0]
  if (!first || first.role !== 'user' || !first.parts?.[0]?.text) {
    return [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\n(sem histórico prévio)` }] },
      ...contents,
    ]
  }
  const rest = contents.slice(1)
  const mergedFirst = {
    role: 'user',
    parts: [
      {
        text: `${systemPrompt}\n\n---\n\n${first.parts[0].text}`,
      },
    ],
  }
  return [mergedFirst, ...rest]
}

/**
 * Tenta extrair um JSON de um texto que pode conter explicações extras.
 */
export function tryParseJsonBlock(text) {
  let clean = text.trim()
  if (clean.startsWith('```json')) clean = clean.replace('```json', '').replace('```', '')
  else if (clean.startsWith('```')) clean = clean.replace('```', '').replace('```', '')
  
  try {
    return JSON.parse(clean.trim())
  } catch {
    const firstBrace = clean.indexOf('{')
    const lastBrace = clean.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const inner = clean.slice(firstBrace, lastBrace + 1)
      return JSON.parse(inner)
    }
    throw new Error('Bloco JSON não encontrado no texto.')
  }
}

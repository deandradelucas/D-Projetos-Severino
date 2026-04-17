import { getSupabaseAdmin } from './supabase-admin.mjs'
import { loadEnv } from './load-env.mjs'
import { log } from './logger.mjs'
import { DEFAULT_CATEGORIES } from './transacoes.mjs'

/**
 * Modelos na ordem de tentativa (API Google AI).
 * 2.0/1.5 costumam estar disponíveis em mais contas; 2.5 pode falhar em chaves/regiões antigas.
 */
const GEMINI_MODEL_FALLBACKS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash']

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

/** POST generateContent com autenticação recomendada pela Google (`x-goog-api-key`, sem `?key=`). */
async function geminiPostGenerateContent(modelId, apiKey, body) {
  const id = encodeURIComponent(String(modelId || GEMINI_MODEL).trim() || GEMINI_MODEL)
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

function resolveGeminiModelCandidates() {
  const envModel = process.env.GEMINI_MODEL?.trim()
  const list = [envModel, ...GEMINI_MODEL_FALLBACKS].filter(Boolean)
  return [...new Set(list)]
}

const MAX_WHATSAPP_AUDIO_BYTES = 12 * 1024 * 1024

/** Normaliza MIME para inline_data do Gemini (WhatsApp costuma enviar opus em OGG). */
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
 * ASR para notas de voz do WhatsApp (pipeline alinhado a voice-ai-specialist: áudio → texto).
 * Usa Gemini multimodal (mesma API que o resto do Horizonte).
 * @param {Buffer|Uint8Array} audioBytes
 * @param {string} [mimeHint] mimetype declarado no payload (ex.: audio/ogg; codecs=opus)
 */
export async function transcribeWhatsAppAudioWithGemini(audioBytes, mimeHint = '') {
  loadEnv()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  const buf = Buffer.isBuffer(audioBytes) ? audioBytes : Buffer.from(audioBytes)
  if (buf.length === 0) throw new Error('Áudio vazio.')
  if (buf.length > MAX_WHATSAPP_AUDIO_BYTES) {
    throw new Error(`Áudio demasiado grande (máx. ${Math.floor(MAX_WHATSAPP_AUDIO_BYTES / 1024 / 1024)} MB).`)
  }

  const mime = normalizeAudioMimeForGemini(mimeHint)
  const b64 = buf.toString('base64')

  const instruction =
    'Transcreve integralmente o áudio em português brasileiro. ' +
    'Devolve apenas o texto ditado pelo utilizador, sem comentários, sem rótulos como "Transcrição:" ou "O utilizador disse". ' +
    'Se não houver fala inteligível, devolve exatamente: (silêncio)'

  const models = resolveGeminiModelCandidates()
  let lastErr = null

  for (const mid of models) {
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: mime, data: b64 } },
            { text: instruction },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.1,
      },
    }

    let response
    try {
      response = await geminiPostGenerateContent(mid, apiKey, body)
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      continue
    }

    if (!response.ok) {
      const t = await response.text()
      let j = {}
      try {
        j = t ? JSON.parse(t) : {}
      } catch {
        j = {}
      }
      const apiMsg = j?.error?.message || t
      lastErr = new Error(`Gemini ${response.status}: ${apiMsg}`)
      const retry =
        response.status === 404 ||
        /not found|is not found|does not exist|invalid model|Unsupported|NOT_FOUND/i.test(String(apiMsg))
      if (retry) continue
      throw lastErr
    }

    const json = await response.json()
    const extracted = extractTextFromGeminiResponse(json)
    if (!extracted.ok) {
      lastErr = new Error(extracted.detail || 'Falha na transcrição')
      continue
    }

    let text = extracted.text.trim()
    if (text.toLowerCase() === '(silêncio)' || text.toLowerCase() === '(silencio)') {
      text = ''
    }
    return text
  }

  if (lastErr) throw lastErr
  throw new Error('Não foi possível transcrever o áudio.')
}

/**
 * Monta `contents` válidos para o Gemini (roles user|model, texto não vazio).
 * Junta mensagens consecutivas do mesmo papel e garante que a conversa comece em `user`.
 */
function buildGeminiContents(historico, message) {
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
 * Extrai texto da resposta generateContent e detecta bloqueios / candidato vazio.
 */
function extractTextFromGeminiResponse(json) {
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

/** Fallback quando `systemInstruction` não é aceite: instruções no início da 1.ª mensagem user. */
function contentsWithSystemPrepended(systemPrompt, contents) {
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
 * Busca o resumo financeiro do usuário para usar como contexto da IA.
 */
async function getContextoFinanceiro(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: transacoes, error } = await supabaseAdmin
    .from('transacoes')
    .select(`
      tipo, valor, descricao, data_transacao, status,
      categorias(nome),
      subcategorias(nome)
    `)
    .eq('usuario_id', usuarioId)
    .order('data_transacao', { ascending: false })
    .limit(100)

  if (error || !transacoes || transacoes.length === 0) {
    return null
  }

  const totalReceitas = transacoes
    .filter(t => t.tipo === 'RECEITA')
    .reduce((sum, t) => sum + parseFloat(t.valor), 0)

  const totalDespesas = transacoes
    .filter(t => t.tipo === 'DESPESA')
    .reduce((sum, t) => sum + parseFloat(t.valor), 0)

  const saldo = totalReceitas - totalDespesas

  // Agrupar despesas por categoria
  const categoriasDespesas = {}
  transacoes
    .filter(t => t.tipo === 'DESPESA')
    .forEach(t => {
      const cat = t.categorias?.nome || 'Sem categoria'
      categoriasDespesas[cat] = (categoriasDespesas[cat] || 0) + parseFloat(t.valor)
    })

  const topCategorias = Object.entries(categoriasDespesas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, valor]) => `  - ${nome}: R$ ${valor.toFixed(2)}`)
    .join('\n')

  // Últimas 10 transações (resumidas)
  const ultimasTransacoes = transacoes.slice(0, 10).map(t => {
    const data = new Date(t.data_transacao).toLocaleDateString('pt-BR')
    const tipo = t.tipo === 'RECEITA' ? '+' : '-'
    const cat = t.categorias?.nome || 'Sem categoria'
    const desc = t.descricao ? ` (${t.descricao})` : ''
    return `  - ${data} | ${tipo} R$ ${parseFloat(t.valor).toFixed(2)} | ${cat}${desc}`
  }).join('\n')

  return `
Resumo financeiro do usuário:
- Total de transações registradas: ${transacoes.length}
- Total de Receitas: R$ ${totalReceitas.toFixed(2)}
- Total de Despesas: R$ ${totalDespesas.toFixed(2)}
- Saldo Atual: R$ ${saldo.toFixed(2)}

Top 5 categorias com mais gastos:
${topCategorias || '  (sem despesas registradas)'}

Últimas 10 transações:
${ultimasTransacoes || '  (sem transações)'}
  `.trim()
}

/**
 * Pergunta ao Horizon: chama a API do Gemini com contexto financeiro do usuário.
 * @param {string} message - Pergunta do usuário
 * @param {string} usuarioId - ID do usuário no banco
 * @param {Array} historico - Array de { role: 'user'|'model', text: string }
 * @returns {Promise<string>} Resposta textual do Gemini
 */
export async function askHorizon(message, usuarioId, historico = []) {
  loadEnv()
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no .env')
  }

  let contexto = null
  try {
    contexto = await getContextoFinanceiro(usuarioId)
  } catch (e) {
    log.warn('[askHorizon] contexto financeiro indisponível', e?.message || e)
  }

  const systemPrompt = `Você é o Horizon, um assistente financeiro pessoal inteligente e amigável do aplicativo "Horizonte Financeiro".

Seu papel é ajudar o usuário a entender e melhorar suas finanças pessoais. Sempre responda em português brasileiro de forma clara, concisa e útil.

Regras importantes:
- Se houver dados financeiros disponíveis, use-os para dar respostas precisas e personalizadas.
- Se os dados não cobrem o que foi perguntado, diga isso de forma honesta e gentil.
- Seja encorajador e proativo com dicas financeiras quando fizer sentido.
- Não invente valores ou dados que não estejam no contexto fornecido.
- Formate valores monetários em Reais (R$) com duas casas decimais.
- Respostas devem ser curtas e objetivas (máximo 3-4 parágrafos normalmente).

${contexto ? `--- DADOS FINANCEIROS ATUAIS DO USUÁRIO ---\n${contexto}\n--- FIM DOS DADOS ---` : 'O usuário ainda não possui transações registradas. Incentive-o a começar a registrar suas finanças.'}`

  const contents = buildGeminiContents(historico, message)
  if (!contents.length) {
    throw new Error('Mensagem inválida.')
  }

  const modelIds = resolveGeminiModelCandidates()
  let lastError = null

  const generationConfig = {
    maxOutputTokens: 1024,
    temperature: 0.7,
  }

  /** Corpo com systemInstruction (preferido). */
  const horizonPayloadWithSystem = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig,
  }

  /** Corpo sem systemInstruction — compatível com mais variantes da API. */
  const horizonPayloadMerged = {
    contents: contentsWithSystemPrepended(systemPrompt, contents),
    generationConfig,
  }

  for (const modelId of modelIds) {
    const payloadsToTry = [horizonPayloadWithSystem, horizonPayloadMerged]

    for (let pi = 0; pi < payloadsToTry.length; pi++) {
      const payload = payloadsToTry[pi]
      try {
        const response = await geminiPostGenerateContent(modelId, apiKey, payload)

        const rawBody = await response.text()
        let json = {}
        try {
          json = rawBody ? JSON.parse(rawBody) : {}
        } catch {
          lastError = new Error(`Gemini resposta inválida (HTTP ${response.status})`)
          if (!response.ok) {
            log.warn('[askHorizon] JSON inválido', {
              modelId,
              strategy: pi === 0 ? 'systemInstruction' : 'merged_system',
              status: response.status,
              snippet: rawBody?.slice(0, 200),
            })
          }
          break
        }

        if (!response.ok) {
          const apiMsg = json?.error?.message || rawBody
          lastError = new Error(`Gemini API ${response.status}: ${apiMsg}`)
          const retryModel =
            response.status === 404 ||
            /not found|is not found|does not exist|invalid model|Unsupported|NOT_FOUND/i.test(String(apiMsg))
          const tryMergedInstead =
            pi === 0 && (response.status === 400 || /Invalid JSON|Unknown name|cannot find field|systemInstruction/i.test(String(apiMsg)))

          if (tryMergedInstead) {
            log.warn('[askHorizon] tentando instruções embutidas na mensagem', { modelId, status: response.status })
            continue
          }
          if (retryModel) {
            log.warn('[askHorizon] modelo indisponível, tentando próximo', { modelId, status: response.status })
            break
          }
          throw lastError
        }

        const extracted = extractTextFromGeminiResponse(json)
        if (extracted.ok) {
          return extracted.text
        }

        if (extracted.kind === 'prompt_blocked' || extracted.kind === 'response_blocked') {
          throw new Error(
            'O assistente não pôde responder a este pedido (filtro de segurança). Reformule com outras palavras.',
          )
        }

        lastError = new Error(`Resposta vazia da API do Gemini (${extracted.kind}: ${extracted.detail})`)
        log.warn('[askHorizon] sem texto útil', {
          modelId,
          strategy: pi === 0 ? 'systemInstruction' : 'merged_system',
          extracted,
        })
        if (pi === 0) {
          continue
        }
        break
      } catch (e) {
        if (e instanceof Error && e.message.includes('filtro de segurança')) {
          throw e
        }
        lastError = e instanceof Error ? e : new Error(String(e))
        log.warn('[askHorizon] falha no modelo', {
          modelId,
          strategy: pi === 0 ? 'systemInstruction' : 'merged_system',
          err: lastError.message,
        })
        if (pi === 0 && lastError.message.includes('Gemini API 400')) {
          continue
        }
        break
      }
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new Error('Não foi possível obter resposta do Gemini.')
}

/**
 * Interpreta uma mensagem de texto (ex: WhatsApp) e a transforma em um objeto de transação.
 * @param {string} message - A mensagem enviada pelo usuário
 * @param {Array} categoriasUsuario - Array das categorias do usuário para mapeamento
 * @returns {Promise<Object>} JSON estruturado
 */
export async function parseWhatsAppMessageWithAI(message, categoriasUsuario) {
  loadEnv()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  // Mapeamos as categorias disponíveis para a IA de forma resumida
  const catMap = categoriasUsuario.map(c => 
    `Categoria: "${c.nome}" (Tipo: ${c.tipo}, ID: ${c.id}) | Subcategorias: ${c.subcategorias.map(s => `"${s.nome}" (ID: ${s.id})`).join(', ')}`
  ).join('\n')

  const systemPrompt = `Você é um robô de extração financeira. Seu papel é receber uma mensagem de texto de um usuário do WhatsApp e transformá-la num JSON estrito contendo os dados da transação financeira.

REGRAS:
1. Retorne APENAS um objeto JSON válido, sem \`\`\`json, sem textos extras em volta.
2. Campos do JSON que você deve retornar:
  - "tipo": "RECEITA" ou "DESPESA" (obrigatório)
  - "valor": um número float representando o valor (obrigatório, se não achar tente deduzir, caso contrário retorne nulo)
  - "descricao": uma breve string do que foi o gasto/receita (obrigatório)
  - "categoria_id": UUID EXATO de uma categoria da lista abaixo cujo "Tipo" seja igual a "tipo" (DESPESA ou RECEITA). Se nenhuma servir, null.
  - "subcategoria_id": UUID EXATO de uma subcategoria que pertença à categoria escolhida (mesma linha na lista). Se não houver subcategoria adequada ou categoria_id for null, use null.

3. A subcategoria_id DEVE ser filha da categoria_id (ambos da mesma categoria na lista). Nunca misture subcategoria de outra categoria.

4. Dicas de mapeamento (mensagem em português) — use os nomes EXATOS das categorias/subcategorias listados acima:
   - mercado, supermercado, feira → DESPESA Alimentação: ex. "Supermercado", "Feira e Sacolão", "Padaria e Cafeteira", "Delivery (iFood, etc)".
   - combustível, posto → Transporte: "Combustível".
   - Uber, 99, táxi → Transporte: "App de Transporte (Uber, 99)" ou "Táxi".
   - restaurante, lanche, iFood → Alimentação: "Restaurantes e Lanches", "Fast Food" ou "Delivery (iFood, etc)".

DADOS DO USUÁRIO PARA MAPEAR:
${catMap || 'O usuário não tem categorias configuradas.'}

MENSAGEM RECEBIDA PARA ANÁLISE:
"${message}"

(Lembre-se: Retorne SOMENTE o JSON puro.)`

  const models = resolveGeminiModelCandidates()
  let response = null
  let lastWhatsappErr = null
  const bodyWhatsapp = {
    contents: [
      {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 500,
      temperature: 0.2,
    },
  }
  for (const mid of models) {
    response = await geminiPostGenerateContent(mid, apiKey, bodyWhatsapp)
    if (response.ok) break
    const t = await response.text()
    let j = {}
    try {
      j = t ? JSON.parse(t) : {}
    } catch {
      j = {}
    }
    const apiMsg = j?.error?.message || t
    lastWhatsappErr = new Error(`Gemini ${response.status}: ${apiMsg}`)
    const retry =
      response.status === 404 ||
      /not found|is not found|does not exist|invalid model|Unsupported|NOT_FOUND/i.test(String(apiMsg))
    if (retry) continue
    throw lastWhatsappErr
  }
  if (!response?.ok) {
    throw lastWhatsappErr || new Error('Falha na API da IA ao analisar mensagem.')
  }

  const json = await response.json()
  let text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  
  text = text.trim()
  if (text.startsWith('```json')) text = text.replace('```json', '').replace('```', '')
  else if (text.startsWith('```')) text = text.replace('```', '').replace('```', '')

  let parsed
  try {
    parsed = JSON.parse(text.trim())
  } catch {
    // Fallback 1: tentar extrair apenas o bloco JSON de dentro do texto retornado
    try {
      const firstBrace = text.indexOf('{')
      const lastBrace = text.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const inner = text.slice(firstBrace, lastBrace + 1)
        parsed = JSON.parse(inner)
      } else {
        throw new Error('no_json_block_found')
      }
    } catch {
      // Fallback 2: parser simples local (sem IA) para mensagens do tipo "Gastei 20 reais na padaria"
      const simples = fallbackParseMensagemSimples(message)
      if (!simples) {
        throw new Error('A IA não conseguiu estruturar os dados da mensagem (' + message + ') corretamente.')
      }
      parsed = simples
    }
  }

  const sanitized = sanitizeTransacaoExtraidaIA(parsed, categoriasUsuario)
  return enriquecerCategoriaPorTexto(message, sanitized, categoriasUsuario)
}

/**
 * Garante que categoria/subcategoria existem, batem com o tipo e a sub pertence à categoria.
 */
export function sanitizeTransacaoExtraidaIA(extractedData, categoriasUsuario) {
  if (!extractedData || typeof extractedData !== 'object') return extractedData

  const tipo = extractedData.tipo
  if (tipo !== 'DESPESA' && tipo !== 'RECEITA') return extractedData

  const cat = categoriasUsuario.find((c) => c.id === extractedData.categoria_id)
  if (!cat || cat.tipo !== tipo) {
    extractedData.categoria_id = null
    extractedData.subcategoria_id = null
    return extractedData
  }

  if (extractedData.subcategoria_id) {
    const subOk = cat.subcategorias?.some((s) => s.id === extractedData.subcategoria_id)
    if (!subOk) extractedData.subcategoria_id = null
  }

  return extractedData
}

function normTxt(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function inferTipoBasicoFromTexto(message) {
  const m = normTxt(message)
  if (/(recebi|ganhei|entrou|caiu na conta|salario|salário|deposito|dep[oó]sito|pix recebido)/.test(m)) {
    return 'RECEITA'
  }
  if (/(gastei|paguei|pago|pagando|comprei|enviei pix|fiz um pix|transferi|debito|d[eé]bito|saquei)/.test(m)) {
    return 'DESPESA'
  }
  // Se falar "gasto", "conta", "boleto" assumimos despesa por padrão
  if (/(gasto|conta|boleto|fatura|aluguel|iptu|luz|agua|água|gas|gás)/.test(m)) {
    return 'DESPESA'
  }
  return null
}

function extrairValorBasicoFromTexto(message) {
  const m = message.match(/(\d+(?:[.,]\d+)?)/)
  if (!m) return null
  let raw = m[1].trim()
  // Formatos comuns BR: 20,50  |  1200  |  1.200,50 (tratamos os mais simples bem)
  if (raw.includes(',') && !raw.includes('.')) {
    raw = raw.replace(',', '.')
  } else if (raw.includes('.') && raw.includes(',')) {
    // "1.200,50" -> "1200.50"
    raw = raw.replace(/\./g, '').replace(',', '.')
  }
  const val = parseFloat(raw)
  if (!isFinite(val) || val <= 0) return null
  return val
}

/**
 * Fallback local quando nem o JSON da IA vem parseável.
 * Consegue lidar com frases simples como:
 * - "Gastei 20 reais na padaria"
 * - "Recebi 1500 de salário"
 */
function fallbackParseMensagemSimples(message) {
  const tipo = inferTipoBasicoFromTexto(message)
  const valor = extrairValorBasicoFromTexto(message)
  if (!tipo || !valor) return null
  return {
    tipo,
    valor,
    descricao: message,
    categoria_id: null,
    subcategoria_id: null,
  }
}

/** Resolve categoria pelo nome exato do seed (`DEFAULT_CATEGORIES`). */
function findCategoryBySeedNome(cats, categoriaNome) {
  const nref = normTxt(categoriaNome)
  return cats.find((c) => c.nome === categoriaNome || normTxt(c.nome) === nref)
}

/**
 * Escolhe subcategoria na ordem de preferência (rótulos iguais ou contidos no nome do banco).
 * Rótulos devem coincidir com `subcategorias` em `DEFAULT_CATEGORIES`.
 */
function findSubPreferida(cat, subLabels) {
  if (!cat?.subcategorias?.length || !subLabels?.length) return null
  for (const label of subLabels) {
    const n = normTxt(label)
    const s = cat.subcategorias.find((sub) => {
      const sn = normTxt(sub.nome)
      return sn === n || sn.includes(n) || n.includes(sn)
    })
    if (s) return s
  }
  return null
}

/** Nomes de categorias válidos no seed (evita typo nas regras). */
const SEED_CAT_NOMES = new Set(DEFAULT_CATEGORIES.map((c) => c.nome))

/**
 * Regras alinhadas a `DEFAULT_CATEGORIES` em transacoes.mjs — ordem: mais específicas primeiro.
 * `categoriaNome` deve existir no seed; `subLabels` são nomes de subcategorias do seed (ordem de prioridade).
 */
const DESPESA_RULES = [
  { re: /atacad|assai|atacadao|makro/i, categoriaNome: 'Alimentação', subLabels: ['Atacadista', 'Supermercado'] },
  { re: /feira|sacolao|sacolão|hortifrut|hortifruti|verdur/i, categoriaNome: 'Alimentação', subLabels: ['Feira e Sacolão', 'Hortifruti', 'Supermercado'] },
  { re: /mercado|supermercado|carrefour|walmart|hiper|pao de acucar|pão de açúcar/i, categoriaNome: 'Alimentação', subLabels: ['Supermercado', 'Atacadista'] },
  { re: /padaria|pao|pão|cafeteria|cafe\b|café/i, categoriaNome: 'Alimentação', subLabels: ['Padaria e Cafeteira'] },
  { re: /açougue|acougue|peixaria|peixe\b/i, categoriaNome: 'Alimentação', subLabels: ['Açougue e Peixaria'] },
  { re: /bebida|cerveja|vinho|refrigerante/i, categoriaNome: 'Alimentação', subLabels: ['Bebidas'] },
  { re: /ifood|rappi|delivery|uber\s*eats|zap\s*food|99\s*food/i, categoriaNome: 'Alimentação', subLabels: ['Delivery (iFood, etc)', 'Restaurantes e Lanches', 'Fast Food'] },
  { re: /restaurante|lanche|almoco|almoço|jantar|mcdonald|burguer|burger|pizza|bk\b/i, categoriaNome: 'Alimentação', subLabels: ['Restaurantes e Lanches', 'Fast Food', 'Delivery (iFood, etc)'] },
  { re: /combust|gasolina|etanol|posto|diesel|shell|ipiranga|petrobras/i, categoriaNome: 'Transporte', subLabels: ['Combustível'] },
  { re: /\buber\b|\b99\b(?!\s*food)|taxi|táxi|cabify|indriver|bolt\b|99pop/i, categoriaNome: 'Transporte', subLabels: ['App de Transporte (Uber, 99)', 'Táxi'] },
  { re: /onibus|ônibus|metro|metrô|vlt|bilhete unico|integracao/i, categoriaNome: 'Transporte', subLabels: ['Transporte Público'] },
  { re: /estaciona|zona azul/i, categoriaNome: 'Transporte', subLabels: ['Estacionamento'] },
  { re: /pedagio|pedágio/i, categoriaNome: 'Transporte', subLabels: ['Pedágio'] },
  { re: /farmacia|drogaria|remedio|remédio|medicamento|droga\b/i, categoriaNome: 'Saúde', subLabels: ['Medicamentos'] },
  { re: /plano de saude|plano de saúde|unimed|amil|bradesco saude/i, categoriaNome: 'Saúde', subLabels: ['Plano de Saúde'] },
  { re: /dentista|odontologia|odontoi/i, categoriaNome: 'Saúde', subLabels: ['Odontologia / Dentista'] },
  { re: /consulta|clinico|clínico|medico\b|médico\b|hospital(?!idade)/i, categoriaNome: 'Saúde', subLabels: ['Consultas Médicas', 'Exames'] },
  { re: /academia|smartfit|musculacao|musculação/i, categoriaNome: 'Saúde', subLabels: ['Academia e Esportes'] },
  { re: /mensalidade.*escola|faculdade|universidade|col[eé]gio|matricula\b|matrícula/i, categoriaNome: 'Educação', subLabels: ['Mensalidade (Escola/Faculdade)'] },
  { re: /curso\b|certificacao|certificação|udemy|alura/i, categoriaNome: 'Educação', subLabels: ['Cursos e Certificações'] },
  { re: /netflix|spotify|prime video|disney\+|hbo|globoplay|assinatura/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Assinaturas (Netflix, Spotify, etc)'] },
  { re: /cinema|show\b|teatro|ingresso.*show/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Cinema, Shows e Teatro'] },
  { re: /bar\b|balada|cervejaria/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Bares e Baladas'] },
  { re: /salao|salão|barbearia|cabelo|manicure/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Salão de Beleza / Barbearia'] },
  { re: /roupa|camisa|calca|calça|tenis|tênis|vestuario/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Vestuário (Roupas do Dia a Dia)', 'Sapatos e Tênis'] },
  { re: /racao|pet\b|dog|gato|veterinar|banho e tosa/i, categoriaNome: 'Pets e Dependentes', subLabels: ['Ração e Alimentação PET', 'Veterinário e Petshop', 'Banho e Tosa'] },
  { re: /passagem|hotel|hospedagem|airbnb|booking/i, categoriaNome: 'Viagens', subLabels: ['Passagens Aéreas / Ônibus', 'Hospedagem / Hotel'] },
  {
    re: /jogo[s]?\s*eletr[ôo]nic|jogos?\s*eletronic|videogame|video[-\s]?game|steam\b|epic\s*games|playstation|ps[45]\b|xbox|nintendo|switch\b|\bdlc\b|jogos?\s*digitais?|jogos?\s*digital|console(s)?\s*(de)?\s*jogo|riot\s*games|battle\.net|gog\.com|humble\s*bundle|microtransa[cç][aã]o|loot\s*box/i,
    categoriaNome: 'Tecnologia e Gadgets',
    subLabels: ['Jogos Digitais / Consoles'],
  },
  { re: /notebook|celular novo|iphone|galaxy|computador|monitor\b|tecnologia/i, categoriaNome: 'Tecnologia e Gadgets', subLabels: ['Computadores e Periféricos', 'Celular Novo e Acessórios'] },
  { re: /aluguel(?!.*receb)/i, categoriaNome: 'Moradia', subLabels: ['Aluguel'] },
  { re: /condominio|condomínio/i, categoriaNome: 'Moradia', subLabels: ['Condomínio'] },
  { re: /luz\b|energia eletrica|energia elétrica|celesc|copel|enel/i, categoriaNome: 'Moradia', subLabels: ['Conta de Luz'] },
  { re: /agua\b|água\b|sanepar|cedae/i, categoriaNome: 'Moradia', subLabels: ['Conta de Água'] },
  { re: /internet\b|fibra|wifi|vivo fibra|net\b claro|oi fibra/i, categoriaNome: 'Moradia', subLabels: ['Internet e TV'] },
  { re: /\bgas\b|glp|botijao|botijão/i, categoriaNome: 'Moradia', subLabels: ['Gás'] },
  { re: /iptu\b/i, categoriaNome: 'Moradia', subLabels: ['IPTU'] },
  { re: /fatura|cartao|cartão|anuidade|ted|pix.*tarifa|tarifa banc/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Pagamento de Fatura (Não Categorizado)', 'Taxas e Tarifas Bancárias', 'Juros Cartão de Crédito'] },
  { re: /emprestimo|empréstimo|financiamento(?!.*veic)/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Parcela de Empréstimo'] },
]

const RECEITA_RULES = [
  { re: /salario|salário|folha|clt|holerite/i, categoriaNome: 'Renda Principal', subLabels: ['Salário'] },
  { re: /ferias|férias/i, categoriaNome: 'Renda Principal', subLabels: ['Férias'] },
  { re: /13o|13º|decimo terceiro|décimo terceiro/i, categoriaNome: 'Renda Principal', subLabels: ['13º Salário'] },
  { re: /plr|bonus|bônus|gratificacao|gratificação/i, categoriaNome: 'Renda Principal', subLabels: ['PLR / Bônus'] },
  { re: /inss|aposentadoria|aposent\b|bpc\b/i, categoriaNome: 'Renda Principal', subLabels: ['Aposentadoria / INSS', 'BPC'] },
  { re: /pro.?labore|prolabore|pró-labore/i, categoriaNome: 'Rendas PJ / Empresa', subLabels: ['Pró-labore', 'Distribuição de Lucros'] },
  { re: /freelance|freela|pj\b|honorario|honorário|servico extra|serviço extra/i, categoriaNome: 'Renda Extra', subLabels: ['Freelance / Serviços Extras'] },
  { re: /venda\b|comiss[aã]o|comission/i, categoriaNome: 'Renda Extra', subLabels: ['Vendas e Comissionamentos', 'Venda de Bens/Ativos Usados'] },
  { re: /aluguel.*receb|rendimento.*aluguel/i, categoriaNome: 'Renda Extra', subLabels: ['Aluguéis Recebidos'] },
  { re: /restituicao|restituição|imposto.*restit/i, categoriaNome: 'Renda Extra', subLabels: ['Restituição de Imposto'] },
  { re: /dividend|fii|fiis|acao|ação|cdb|tesouro|juros.*receb|rendimento.*invest/i, categoriaNome: 'Rendimentos e Benefícios', subLabels: ['Dividendos (Ações e FIIs)', 'Rendimento de Investimentos', 'Juros Recebidos'] },
  { re: /fgts|seguro.desemprego|abono|auxilio|auxílio|mesada recebida/i, categoriaNome: 'Rendimentos e Benefícios', subLabels: ['FGTS', 'Seguro-Desemprego', 'Abono Salarial', 'Auxílios Governamentais', 'Mesada Recebida'] },
]

function rulesForTipo(tipo) {
  return tipo === 'RECEITA' ? RECEITA_RULES : DESPESA_RULES
}

/**
 * Se a IA deixou categoria/subcategoria vazias, tenta casar palavras da mensagem com nomes reais do usuário.
 */
export function enriquecerCategoriaPorTexto(message, extractedData, categoriasUsuario) {
  if (!extractedData || !categoriasUsuario?.length) return extractedData

  const tipo = extractedData.tipo
  if (tipo !== 'DESPESA' && tipo !== 'RECEITA') return extractedData

  const low = normTxt(message)
  const catsTipo = categoriasUsuario.filter((c) => c.tipo === tipo)

  if (extractedData.categoria_id && !extractedData.subcategoria_id) {
    const cat = categoriasUsuario.find((c) => c.id === extractedData.categoria_id && c.tipo === tipo)
    if (cat?.subcategorias?.length) {
      for (const rule of rulesForTipo(tipo)) {
        if (!rule.categoriaNome || !rule.subLabels?.length) continue
        if (!SEED_CAT_NOMES.has(rule.categoriaNome)) continue
        if (!rule.re.test(low)) continue
        if (findCategoryBySeedNome(catsTipo, rule.categoriaNome)?.id !== cat.id) continue
        const sub = findSubPreferida(cat, rule.subLabels)
        if (sub) {
          extractedData.subcategoria_id = sub.id
          return extractedData
        }
      }
    }
  }

  if (extractedData.categoria_id && extractedData.subcategoria_id) return extractedData

  for (const rule of rulesForTipo(tipo)) {
    if (!rule.categoriaNome || !rule.subLabels?.length) continue
    if (!SEED_CAT_NOMES.has(rule.categoriaNome)) continue
    if (!rule.re.test(low)) continue
    const cat = findCategoryBySeedNome(catsTipo, rule.categoriaNome)
    if (!cat) continue
    const sub = findSubPreferida(cat, rule.subLabels)
    if (sub) {
      extractedData.categoria_id = cat.id
      extractedData.subcategoria_id = sub.id
      return extractedData
    }
  }

  return extractedData
}

/**
 * Fallback: Gemini compara dígitos do webhook (LID/ruído) com telefones cadastrados no Supabase.
 */
export async function resolverUsuarioIdPorTelefoneGemini(digitosWebhook, usuarios) {
  loadEnv()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || !digitosWebhook || !usuarios?.length) return null

  const digitos = String(digitosWebhook).replace(/\D/g, '')
  const lista = usuarios
    .map((u, i) => `${i + 1}. usuario_id="${u.id}" telefone="${String(u.telefone || '').replace(/\D/g, '')}"`)
    .join('\n')

  const prompt = `Você faz pareamento de telefone entre um identificador vindo do WhatsApp (webhook Baileys/Telein) e usuários cadastrados no Brasil.

DÍGITOS DO WEBHOOK (podem ter comprimento estranho por LID @lid, dígito extra, ou falta do 55):
${digitos}

USUÁRIOS CADASTRADOS (apenas dígitos do telefone):
${lista}

Regras:
- Celular BR costuma ser: opcional DDI 55 + DDD (2 dígitos) + 9 dígitos (celular: primeiro dígito após DDD é 9).
- O mesmo aparelho pode aparecer como 11999887766, 5511999887766, ou com sufixo/prefixo diferente por ID interno.
- Escolha no máximo UM usuario_id que seja claramente o mesmo número físico.

Responda APENAS JSON válido, sem markdown:
{"usuario_id":"<uuid>"}
ou
{"usuario_id":null}`

  try {
    const bodyTel = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
    }
    let response = null
    for (const mid of resolveGeminiModelCandidates()) {
      response = await geminiPostGenerateContent(mid, apiKey, bodyTel)
      if (response.ok) break
      const t = await response.text()
      let j = {}
      try {
        j = t ? JSON.parse(t) : {}
      } catch {
        j = {}
      }
      const apiMsg = j?.error?.message || t
      const retry =
        response.status === 404 ||
        /not found|is not found|does not exist|invalid model|Unsupported|NOT_FOUND/i.test(String(apiMsg))
      if (!retry) return null
    }
    if (!response?.ok) return null

    const json = await response.json()
    let text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    text = text.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    }

    const parsed = JSON.parse(text)
    const id = parsed?.usuario_id
    if (!id || typeof id !== 'string') return null

    const valid = usuarios.find((u) => u.id === id)
    return valid || null
  } catch {
    return null
  }
}

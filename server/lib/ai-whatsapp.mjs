import './load-env.mjs'
import { log } from './logger.mjs'
import {
  geminiPostGenerateContent,
  resolveGeminiModelCandidates,
} from './ai/gemini-client.mjs'
import {
  normalizeAudioMimeForGemini,
  sniffAudioMimeFromBuffer,
  extractTextFromGeminiResponse,
  tryParseJsonBlock,
} from './ai/parsers.mjs'
import {
  enriquecerCategoriaPorTexto,
  fallbackParseMensagemSimples,
} from './domain/transaction-heuristics.mjs'

const MAX_WHATSAPP_AUDIO_BYTES = 20 * 1024 * 1024

function looksLikeNonBinaryAudioPayload(buf) {
  if (!buf?.length) return false
  const head = buf.subarray(0, Math.min(buf.length, 120)).toString('utf8').trimStart()
  if (head.startsWith('<')) return true
  if (head.startsWith('{')) {
    try {
      const slice = buf.subarray(0, Math.min(buf.length, 8000)).toString('utf8')
      const j = JSON.parse(slice)
      if (j && (j.error || j.message === 'Unauthorized' || j.statusCode)) return true
    } catch {
      /* binário que começa por "{" é raro em áudio; ignorar */
    }
  }
  return false
}

function uniqueMimeCandidates(buf, mimeHint) {
  const sniffed = sniffAudioMimeFromBuffer(buf)
  const norm = normalizeAudioMimeForGemini(mimeHint)
  const raw = [sniffed, norm, 'audio/ogg', 'audio/webm', 'audio/mpeg', 'audio/mp4'].filter(Boolean)
  const seen = new Set()
  const out = []
  for (const m of raw) {
    if (seen.has(m)) continue
    seen.add(m)
    out.push(m)
  }
  return out
}

/**
 * ASR para notas de voz do WhatsApp.
 */
export async function transcribeWhatsAppAudioWithGemini(audioBytes, mimeHint = '') {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  const buf = Buffer.isBuffer(audioBytes) ? audioBytes : Buffer.from(audioBytes)
  if (buf.length === 0) throw new Error('Áudio vazio.')
  if (buf.length > MAX_WHATSAPP_AUDIO_BYTES) {
    throw new Error(`Áudio demasiado grande (máx. ${Math.floor(MAX_WHATSAPP_AUDIO_BYTES / 1024 / 1024)} MB).`)
  }

  if (looksLikeNonBinaryAudioPayload(buf)) {
    throw new Error('Áudio inválido (payload não é ficheiro de som).')
  }

  const b64 = buf.toString('base64')

  const instruction =
    'Transcreve integralmente o áudio em português brasileiro. ' +
    'Contexto: assistente financeiro pessoal — o usuário provavelmente menciona valores monetários ("dois mil reais", "R$ 500", "trezentos e vinte"), compras ou despesas. ' +
    'Transcreva valores monetários com precisão, mantendo exatamente as palavras ditas (ex.: "dois mil reais", não "2000 reais"). ' +
    'Devolve apenas o texto ditado pelo utilizador, sem comentários, sem rótulos como "Transcrição:" ou "O utilizador disse". ' +
    'Se não houver fala inteligível, devolve exatamente: (silêncio)'

  const mimes = uniqueMimeCandidates(buf, mimeHint)
  const models = resolveGeminiModelCandidates()
  let lastErr = null

  modelLoop: for (const mid of models) {
    for (const mime of mimes) {
      const partVariants = [
        [{ text: instruction }, { inline_data: { mime_type: mime, data: b64 } }],
        [{ inline_data: { mime_type: mime, data: b64 } }, { text: instruction }],
      ]
      for (const parts of partVariants) {
        const body = {
          contents: [{ role: 'user', parts }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.1,
          },
        }

        try {
          const response = await geminiPostGenerateContent(mid, apiKey, body)
          if (!response.ok) {
            const t = await response.text()
            const apiMsg = t?.slice(0, 500)
            lastErr = new Error(`Gemini ${response.status}: ${apiMsg}`)
            if (response.status === 401) throw lastErr
            if (response.status === 404 || /not found/i.test(apiMsg)) continue modelLoop
            continue
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
        } catch (e) {
          if (e?.message?.includes?.('401')) throw e
          lastErr = e
          continue
        }
      }
    }
  }

  log.warn({ msg: 'whatsapp_audio_transcribe_failed', detail: String(lastErr?.message || lastErr) })
  if (lastErr) throw lastErr
  throw new Error('Não foi possível transcrever o áudio.')
}

/**
 * Interpreta mensagem de WhatsApp.
 */
export async function parseWhatsAppMessageWithAI(message, categoriasUsuario) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  const catMap = categoriasUsuario.map(c =>
    `Categoria: "${c.nome}" (Tipo: ${c.tipo}, ID: ${c.id}) | Subcategorias: ${c.subcategorias.map(s => `"${s.nome}" (ID: ${s.id})`).join(', ')}`
  ).join('\n')

  const systemPrompt = `Você é um robô de extração financeira de alta precisão e assistente pessoal.
Sua tarefa é analisar mensagens (texto ou áudio) e decidir se são uma TRANSAÇÃO FINANCEIRA ou apenas uma CONVERSA/CHAT.

REGRAS OBRIGATÓRIAS:
1. Se for TRANSAÇÃO (gasto ou receita):
   - Identifique o TIPO: "DESPESA" ou "RECEITA".
   - Identifique o VALOR: número decimal puro, sem separadores (ex.: 2000, 1500.50). Formatos aceitos:
     * Separador de milhar BR: "R$ 2.000" → 2000 (NÃO 2.0), "R$ 1.500,50" → 1500.50. O ponto em "2.000" é milhar, NÃO decimal.
     * Verbais simples: "cinquenta reais" → 50, "trinta" → 30.
     * Verbais compostos: "dois mil" → 2000, "três mil e quinhentos" → 3500, "dois mil e duzentos reais" → 2200.
   - Identifique a DESCRIÇÃO: curta e clara (do que se trata o lançamento).
   - Mapeie para as CATEGORIAS fornecidas usando os IDs exatos. Prefira SUBCATEGORIA quando o texto for específico (ex.: Uber → transporte por app; iFood → alimentação delivery).
   - OBRIGATÓRIO: SEMPRE informe categoria_id e subcategoria_id quando for DESPESA ou RECEITA — mesmo que o contexto seja incomum (poker, apostas, hobby, presente, etc.). Escolha a categoria e subcategoria MAIS PRÓXIMAS do contexto. NUNCA retorne categoria_id como null para transações.
   - Opcional: "data_transacao" em ISO 8601 completo se o usuário mencionar QUANDO ocorreu ("hoje às 14h", "ontem", "dia 15/03 às 9h", "amanhã de manhã"). Use o fuso America/Sao_Paulo. Se não houver menção de data/hora, use null.
2. Se NÃO for transação (ex: comentários, perguntas, saudações, filosofia):
   - Identifique o TIPO como "CHAT".
   - Crie uma RESPOSTA curta, inteligente e amigável na voz do "Severino" (só usada se o servidor não puder chamar o assistente completo).
   - Deixe valor, categoria_id, subcategoria_id e data_transacao como null.
3. Retorne APENAS o bloco JSON puro.

DADOS DO USUÁRIO PARA MAPEAR:
${catMap || 'O usuário não tem categorias configuradas.'}

MENSAGEM DO USUÁRIO: "${message}"

Exemplo de retorno (Transação):
{"tipo": "DESPESA", "valor": 12.50, "descricao": "Café", "categoria_id": "...", "subcategoria_id": "...", "data_transacao": null}

Exemplo de retorno (Chat):
{"tipo": "CHAT", "valor": null, "descricao": "Conversa", "resposta": "Entendi perfeitamente! Como seu assistente, estou aqui para ouvir e ajudar no que for preciso.", "data_transacao": null}

ATENÇÃO: Nunca responda com texto puro. Sempre use o formato JSON acima. Se a mensagem for irrelevante ou incompreensível, use o tipo "CHAT".`

  const models = resolveGeminiModelCandidates()
  let lastWhatsappErr = null

  for (const mid of models) {
    try {
      const response = await geminiPostGenerateContent(mid, apiKey, {
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.2 },
      })

      if (!response.ok) {
        const t = await response.text()
        lastWhatsappErr = new Error(`Gemini ${response.status}: ${t.slice(0, 200)}`)
        continue
      }

      const json = await response.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''

      const parsed = tryParseJsonBlock(text)
      const sanitized = sanitizeTransacaoExtraidaIA(parsed, categoriasUsuario)
      return enriquecerCategoriaPorTexto(message, sanitized, categoriasUsuario)
    } catch {
      // Fallback 1: Tenta extrair o básico (valor/tipo) localmente
      const simples = fallbackParseMensagemSimples(message)
      if (simples) return enriquecerCategoriaPorTexto(message, simples, categoriasUsuario)

      // Fallback 2: Se não é transação, trata como CHAT sem erro
      return {
        tipo: 'CHAT',
        valor: null,
        descricao: 'Conversa',
        resposta: 'Entendi o que você disse, mas não identifiquei uma transação financeira nessa mensagem. Se quiser lançar um gasto, pode falar algo como "gastei 50 no mercado".'
      }
    }
  }

  // Todos os modelos falharam — tenta fallback local antes de lançar o erro
  const fallbackFinal = fallbackParseMensagemSimples(message)
  if (fallbackFinal) return enriquecerCategoriaPorTexto(message, fallbackFinal, categoriasUsuario)

  throw lastWhatsappErr || new Error('Falha na IA ao analisar mensagem.')
}

/**
 * Garante que categoria/subcategoria existem e batem com o tipo.
 */
export function sanitizeTransacaoExtraidaIA(extractedData, categoriasUsuario) {
  if (!extractedData || typeof extractedData !== 'object') return extractedData
  const tipo = extractedData.tipo
  if (tipo === 'CHAT') return extractedData
  if (tipo !== 'DESPESA' && tipo !== 'RECEITA') return extractedData

  if (extractedData.data_transacao != null && extractedData.data_transacao !== '') {
    const d = new Date(extractedData.data_transacao)
    if (Number.isNaN(d.getTime())) extractedData.data_transacao = null
  } else {
    extractedData.data_transacao = null
  }

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

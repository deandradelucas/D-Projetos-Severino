import './load-env.mjs'
import { log } from './logger.mjs'
import {
  buildGeminiGenerationConfig,
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

/** Retorna data e hora atual no fuso de São Paulo, formatada em português. */
function dataHoraAtualSP() {
  try {
    const now = new Date()
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)
    const p = Object.fromEntries(partes.map((x) => [x.type, x.value]))
    return `${p.weekday}, ${p.day} de ${p.month} de ${p.year} às ${p.hour}:${p.minute} (horário de Brasília)`
  } catch {
    return new Date().toISOString()
  }
}

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
    'Você é um transcritor de áudio para um assistente financeiro pessoal brasileiro chamado Severino. ' +
    'Transcreva integralmente o áudio em português brasileiro com máxima fidelidade às palavras ditas. ' +
    'CONTEXTO: o usuário provavelmente menciona ' +
    'valores monetários ("vinte e cinco reais", "R$ 300", "dois mil e quinhentos", "oitenta e nove vírgula noventa", "cinco e vinte"), ' +
    'ações financeiras ("paguei", "gastei", "comprei", "recebi", "entrou na conta", "caiu", "mandei pix", "transferi", "tomei um uber"), ' +
    'e estabelecimentos ou serviços (mercado, farmácia, padaria, Uber, iFood, Rappi, Netflix, academia, salão, Smart Fit, Drogasil, Pão de Açúcar). ' +
    'REGRAS OBRIGATÓRIAS: ' +
    '(1) Transcreva EXATAMENTE as palavras ditas, sem corrigir gramática ou interpretar intenção. ' +
    '(2) Preserve nomes de marcas como pronunciados: "iFood", "Smart Fit", "Drogasil", "Pão de Açúcar", "Mc Donalds". ' +
    '(3) Mantenha valores verbais literalmente: "dois e cinquenta" permanece "dois e cinquenta", não "2,50". ' +
    '(4) Se houver ruído de fundo mas a fala for inteligível, transcreva apenas a fala. ' +
    '(5) Retorne APENAS o texto transcrito, sem prefixos como "Transcrição:" ou comentários adicionais. ' +
    'Se não houver fala inteligível, retorne exatamente: (silêncio)'

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
          generationConfig: buildGeminiGenerationConfig(mid, {
            maxOutputTokens: 1024,
            temperature: 0.1,
          }),
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

  const catMap = categoriasUsuario.map((c) => {
    const subs = c.subcategorias.map((s) => `    • "${s.nome}" → ID: ${s.id}`).join('\n')
    return `▸ ${c.tipo} | Categoria: "${c.nome}" → ID: ${c.id}\n${subs}`
  }).join('\n')

  const dataAtual = dataHoraAtualSP()

  const systemPrompt = `Você é o Severino, assistente financeiro pessoal. Analise a mensagem e extraia os dados de transação OU identifique como conversa.

DATA E HORA ATUAL: ${dataAtual}
Use essa data para resolver referências temporais: "hoje", "ontem", "anteontem", "semana passada", "sexta", "dia 15", "essa manhã", "de tarde".
Converta SEMPRE para ISO 8601 completo no fuso America/Sao_Paulo (ex: "2026-05-25T14:30:00-03:00").

━━━ REGRAS DE CLASSIFICAÇÃO ━━━

TIPO = "DESPESA" → paguei, gastei, comprei, tomei (uber), fui em, comi, bebi, assinei, renovei, transferi, mandei pix, enviei
TIPO = "RECEITA" → recebi, entrou, caiu, ganhei, me pagaram, pix de [pessoa], salário, dividendo, vendeu
TIPO = "CHAT"    → saudações, perguntas, comentários gerais, qualquer coisa que não seja lançamento financeiro

━━━ EXTRAÇÃO DO VALOR ━━━

Retorne número decimal puro (ex: 1500.50), aplicando estas conversões:
• "R$ 2.000"              → 2000    (ponto = milhar BR, NÃO decimal)
• "R$ 1.500,50"           → 1500.50
• "cinquenta reais"       → 50
• "dois mil e quinhentos" → 2500
• "cento e vinte e três"  → 123
• "cinco e vinte"         → 5.20    (R$5,20 — reais e centavos)
• "oitenta e nove vírgula noventa" → 89.90
• "trezentos"             → 300

━━━ DESCRIÇÃO ━━━

Seja ESPECÍFICO — nunca retorne apenas "Compra" ou "Pagamento":
• Se houver nome de estabelecimento → use-o: "Uber", "iFood", "Drogasil", "Smart Fit"
• Se não houver → use verbo + contexto: "Almoço no restaurante", "Conta de luz", "Mercado semanal"
• Máximo 50 caracteres

━━━ CATEGORIA E SUBCATEGORIA ━━━

OBRIGATÓRIO para DESPESA e RECEITA — use os IDs EXATOS da lista abaixo.
Escolha a MAIS ESPECÍFICA. Exemplos rápidos:
• iFood / Rappi / Uber Eats / delivery    → Alimentação → Delivery
• Uber / 99 / Cabify / aplicativo         → Transporte → App de Transporte
• Farmácia / remédio / medicamento        → Saúde → Medicamentos
• Academia / SmartFit / musculação        → Saúde → Academia e Esportes
• Netflix / Spotify / streaming           → Lazer e Entretenimento → Assinaturas
• Mercado / supermercado / feira          → Alimentação → Supermercado
• Salário / CLT / holerite               → Renda Principal → Salário
• Pix recebido de pessoa                  → Receitas Eventuais → Ajuda Familiar Recebida
• Gasolina / posto / combustível          → Transporte → Combustível
• Luz / energia / água / gás / internet   → Moradia → (categoria correspondente)
• Aluguel (pagando)                       → Moradia → Aluguel
• Consulta médica / dentista              → Saúde → Consultas Médicas
• Roupa / tênis / vestuário               → Cuidados Pessoais → Vestuário
• Salão / barbearia / cabelo              → Cuidados Pessoais → Salão de Beleza

━━━ CATEGORIAS DO USUÁRIO ━━━
${catMap || 'Usuário sem categorias configuradas — use categoria_id: null.'}

━━━ FORMATO DE RETORNO (JSON PURO, sem markdown, sem explicações) ━━━

Transação:
{"tipo":"DESPESA","valor":12.50,"descricao":"iFood — Hambúrguer","categoria_id":"UUID_EXATO","subcategoria_id":"UUID_EXATO","data_transacao":null}

Chat:
{"tipo":"CHAT","valor":null,"descricao":null,"resposta":"Resposta amigável do Severino","categoria_id":null,"subcategoria_id":null,"data_transacao":null}

MENSAGEM DO USUÁRIO: "${message}"`

  const models = resolveGeminiModelCandidates()
  let lastWhatsappErr = null

  for (const mid of models) {
    try {
      const response = await geminiPostGenerateContent(mid, apiKey, {
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: buildGeminiGenerationConfig(mid, { maxOutputTokens: 500, temperature: 0.2 }),
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

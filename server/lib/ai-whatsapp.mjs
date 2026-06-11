import './load-env.mjs'
import { log } from './logger.mjs'
import { buscarExemplosFewShotTitulo } from './domain/agenda-title-logger.mjs'
import { buscarExemplosCategoria } from './domain/transacao-categoria-logger.mjs'
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
import { groqChatCompletion, groqTranscribeAudio } from './ai/groq-client.mjs'
import { aiCacheKey, aiCacheGet, aiCacheSet, AI_CACHE_TTL } from './ai/ai-cache.mjs'
import { recordAiCall, recordCache } from './ai/ai-telemetry.mjs'
import { hojeYmdBrt } from './date-brt.mjs'

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
 * Remove prefixos genéricos e capitaliza a descrição extraída pela IA.
 */
function normalizarDescricao(desc) {
  if (!desc || typeof desc !== 'string') return desc
  let d = desc.trim()
  d = d.replace(/^(compra\s+de\s+|pagamento\s+de\s+|gasto\s+com\s+|despesa\s+com\s+)/i, '')
  d = d.replace(/^(\w)/, (c) => c.toUpperCase())
  return d.length > 80 ? d.slice(0, 77) + '…' : d
}

/**
 * Monta o system_instruction de parse financeiro (compartilhado entre texto e áudio).
 */
function buildTransactionParseSystemInstruction(catMap, dataAtual, tituloExemplos = [], categoriaExemplos = []) {
  const fewShot = Array.isArray(tituloExemplos) && tituloExemplos.length
    ? '\n\n━━━ TÍTULOS PREFERIDOS POR ESTE USUÁRIO (correções reais — imite ESTE estilo no campo "titulo" de AGENDA) ━━━\n' +
      tituloExemplos.map((e) => `• "${e.transcricao}" → "${e.titulo}"`).join('\n')
    : ''
  const catFewShot = Array.isArray(categoriaExemplos) && categoriaExemplos.length
    ? '\n\n━━━ REGRA PRIORITÁRIA — CORREÇÕES DESTE USUÁRIO (SOBREPÕEM o guia geral acima) ━━━\n' +
      'Se a descrição for igual ou muito parecida com um destes casos, use EXATAMENTE a categoria indicada, MESMO que o guia geral sugira outra. A escolha do usuário vale mais que a regra geral:\n' +
      categoriaExemplos.map((e) => `• "${e.descricao}"${e.tipo ? ` (${e.tipo})` : ''} → use a categoria "${e.categoria_nome}"`).join('\n')
    : ''
  return `Você é o Severino, assistente pessoal brasileiro. Analise a mensagem e determine a intenção principal.

DATA E HORA ATUAL: ${dataAtual}
Use essa data para resolver referências temporais ("hoje", "ontem", "anteontem", "semana passada", "sexta", "dia 15", "essa manhã").
Converta para ISO 8601 completo no fuso America/Sao_Paulo (ex: "2026-05-25T14:30:00-03:00").

━━━ CLASSIFICAÇÃO (escolha UMA) ━━━

DESPESA → paguei, gastei, comprei, tomei (uber/taxi), fui em/no/na, comi, bebi, assinei, renovei, transferi, mandei pix, enviei, abasteci, botei gasolina, coloquei crédito
RECEITA → recebi, entrou, caiu, ganhei, me pagaram, pix de [pessoa], salário, dividendo, vendi
AGENDA  → CRIAR evento FUTURO: marcar, agendar, coloca na agenda, reunião (futura), compromisso, consulta (futura), dentista (futuro), médico (futuro), lembrete de horário, "amanhã às X", "sexta às X", "no dia X às X", "me lembra de X"; NÃO é AGENDA se é passado ("fui ao dentista", "tive reunião")
CHAT    → saudações, perguntas, comentários que não são lançamentos financeiros nem agenda futura

━━━ VALOR (número decimal puro) ━━━

REGRA DE OURO: a palavra "mil" SEMPRE multiplica por 1000 — inclusive depois de
dígito. "21 mil" = 21000, NUNCA 21. No formato BR, ponto é separador de MILHAR e
vírgula é separador de CENTAVOS: "21.000,00" = 21000 (vinte e um mil).

• "21 mil"                → 21000  (dígito + "mil" = ×1000)
• "5 mil"                 → 5000
• "1,5 mil" / "1.5 mil"   → 1500
• "21.000,00"             → 21000  (ponto = milhar, vírgula = centavos)
• "R$ 2.000"              → 2000   (ponto = milhar BR, NÃO decimal)
• "R$ 1.500,50"           → 1500.50
• "cinquenta reais"       → 50
• "dois mil e quinhentos" → 2500
• "vinte e um mil"        → 21000
• "cento e vinte e três"  → 123
• "cinco e vinte"         → 5.20   (R$5,20 = reais e centavos)
• "oitenta e nove vírgula noventa" → 89.90
• "trezentos"             → 300

━━━ PARCELAMENTO E RECORRÊNCIA (só quando o usuário diz EXPLICITAMENTE) ━━━

• Compra parcelada — "em 3x", "parcelei em 10 vezes", "dividi em 6x":
  → "parcelamento": {"num_parcelas": N}
  → "valor" é SEMPRE o TOTAL da compra: "3x de 100" → valor 300; "TV de 3000 em 10x" → valor 3000
• Lançamento que se repete com prazo — "aluguel de 1200 por 12 meses", "curso de 200 por 6 meses", "toda semana por 8 semanas":
  → "recorrencia": {"quantidade": N, "frequencia": "MENSAL"|"SEMANAL"|"ANUAL"}
  → "valor" é o valor de CADA ocorrência (não o total)
• Sem número de vezes explícito ("assinei a Netflix", "pago todo mês" sem prazo) → NÃO retorne parcelamento nem recorrencia
• NUNCA retorne os dois juntos

━━━ VÁRIAS TRANSAÇÕES NA MESMA MENSAGEM ━━━

• "gastei 50 no mercado e 30 na farmácia" → tipo "MULTIPLO" com TODAS no array "transacoes"
• Cada item do array segue o formato de Transação (tipo DESPESA ou RECEITA, sem parcelamento/recorrencia)
• Use MULTIPLO apenas com 2+ lançamentos de valores DISTINTOS na mesma mensagem; um lançamento só → formato normal

━━━ DESCRIÇÃO (específica, max 60 chars) ━━━

• Nome do estabelecimento quando mencionado: "Uber", "iFood", "Drogasil", "Smart Fit"
• Sem nome: verbo + contexto: "Almoço no restaurante", "Conta de luz", "Mercado"
• NUNCA retorne apenas "Compra", "Pagamento" ou "Despesa"

━━━ CATEGORIA/SUBCATEGORIA — USE IDs EXATOS ━━━

Escolha a mais específica. Guia rápido:
iFood/Rappi/Uber Eats/delivery → Alimentação → Delivery
Uber/99/Cabify/aplicativo      → Transporte → App de Transporte (Uber, 99)
Farmácia/remédio               → Saúde → Medicamentos
Academia/SmartFit/musculação   → Saúde → Academia e Esportes
Netflix/Spotify/Max/streaming  → Lazer e Entretenimento → Assinaturas
Mercado/supermercado/feira     → Alimentação → Supermercado
Salário/CLT/holerite           → Renda Principal → Salário
Pix recebido de pessoa         → Receitas Eventuais → Ajuda Familiar Recebida
Gasolina/posto/combustível     → Transporte → Combustível
Conta de luz                   → Moradia → Conta de Luz
Conta de água                  → Moradia → Conta de Água
Internet/fibra/wi-fi           → Moradia → Internet e TV
Gás/botijão                    → Moradia → Gás
Aluguel (pagando)              → Moradia → Aluguel
Consulta médica/dentista       → Saúde → Consultas Médicas
Salão/barbearia/cabelo/barba   → Cuidados Pessoais → Salão de Beleza / Barbearia
Roupa/tênis/vestuário          → Cuidados Pessoais → Vestuário

━━━ CATEGORIAS DO USUÁRIO ━━━
${catMap || 'Sem categorias — use categoria_id: null.'}

━━━ RETORNO: JSON PURO (sem markdown, sem texto extra) ━━━

Transação: {"tipo":"DESPESA","valor":12.50,"descricao":"iFood","categoria_id":"UUID","subcategoria_id":"UUID","data_transacao":null,"parcelamento":null,"recorrencia":null}
Parcelada:  {"tipo":"DESPESA","valor":300,"descricao":"Tênis","categoria_id":"UUID","subcategoria_id":"UUID","data_transacao":null,"parcelamento":{"num_parcelas":3},"recorrencia":null}
Recorrente: {"tipo":"DESPESA","valor":1200,"descricao":"Aluguel","categoria_id":"UUID","subcategoria_id":"UUID","data_transacao":null,"parcelamento":null,"recorrencia":{"quantidade":12,"frequencia":"MENSAL"}}
Múltiplas:  {"tipo":"MULTIPLO","transacoes":[{"tipo":"DESPESA","valor":50,"descricao":"Mercado","categoria_id":"UUID","subcategoria_id":"UUID","data_transacao":null},{"tipo":"DESPESA","valor":30,"descricao":"Farmácia","categoria_id":"UUID","subcategoria_id":"UUID","data_transacao":null}]}
Agenda:    {"tipo":"AGENDA","transcricao":"texto completo e fiel do que foi dito, incluindo data e horário","titulo":"Título limpo do evento em 2-5 palavras sem data/hora. Ex: 'Reunião de equipe', 'Consulta médica', 'Pagar boleto do condomínio', 'Dentista'. Capitalizado, sem verbo de agendamento."}
Chat:      {"tipo":"CHAT","valor":null,"descricao":null,"resposta":"Resposta amigável","categoria_id":null,"subcategoria_id":null,"data_transacao":null}${fewShot}${catFewShot}`
}

/**
 * Pós-processamento comum aos 3 caminhos de parse (Gemini texto, Groq texto,
 * Gemini áudio): normaliza descrição, sanitiza e enriquece categoria. Para
 * MULTIPLO, cada transação é enriquecida pela PRÓPRIA descrição (usar a
 * mensagem inteira faria a heurística da 1ª compra contaminar as demais).
 */
function finalizeParsedTransacao(parsed, message, categoriasUsuario) {
  if (!parsed) return parsed
  if (parsed.descricao) parsed.descricao = normalizarDescricao(parsed.descricao)
  const sanitized = sanitizeTransacaoExtraidaIA(parsed, categoriasUsuario)
  if (sanitized?.tipo === 'MULTIPLO') {
    sanitized.transacoes = (sanitized.transacoes || []).map((t) => {
      if (t.descricao) t.descricao = normalizarDescricao(t.descricao)
      return enriquecerCategoriaPorTexto(t.descricao || '', t, categoriasUsuario)
    })
    return sanitized
  }
  const textoEnriquecimento = [message, sanitized?.descricao].filter(Boolean).join(' ')
  return enriquecerCategoriaPorTexto(textoEnriquecimento, sanitized, categoriasUsuario)
}

/** Resultado é cacheável/útil? (transação única válida ou lote não-vazio) */
function isParsedResultUtil(result) {
  if (!result || result.tipo === 'CHAT') return false
  if (result.tipo === 'MULTIPLO') return Array.isArray(result.transacoes) && result.transacoes.length > 0
  return result.valor != null && Boolean(result.descricao)
}

/**
 * Interpreta mensagem de WhatsApp.
 */
export async function parseWhatsAppMessageWithAI(message, categoriasUsuario, usuarioId) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  // AC2: cache na frente — chave inclui data BRT para não vazar respostas "hoje/ontem"
  const cacheKey = aiCacheKey('parse-tx', message.trim().toLowerCase(), hojeYmdBrt(), usuarioId)
  try {
    const cached = await aiCacheGet(cacheKey)
    if (cached !== null) {
      recordCache(true)
      return cached
    }
    recordCache(false)
  } catch {
    // cache best-effort — nunca bloqueia o fluxo
  }

  const catMap = categoriasUsuario.map((c) => {
    const subs = c.subcategorias.map((s) => `    • "${s.nome}" → ID: ${s.id}`).join('\n')
    return `▸ ${c.tipo} | Categoria: "${c.nome}" → ID: ${c.id}\n${subs}`
  }).join('\n')

  const [tituloExemplos, categoriaExemplos] = await Promise.all([
    buscarExemplosFewShotTitulo(usuarioId),
    buscarExemplosCategoria(usuarioId),
  ])
  const systemInstruction = buildTransactionParseSystemInstruction(catMap, dataHoraAtualSP(), tituloExemplos, categoriaExemplos)
  const userMessage = `MENSAGEM: "${message}"`

  const models = resolveGeminiModelCandidates()
  let lastWhatsappErr = null
  // AC6: flag para saber se todos os modelos Gemini falharam (HTTP OU exceção)
  let geminiExhausted = false

  for (const mid of models) {
    let httpFailed = false
    try {
      const genCfg = buildGeminiGenerationConfig(mid, { maxOutputTokens: 700, temperature: 0.15 })

      const response = await geminiPostGenerateContent(mid, apiKey, {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: genCfg,
      })

      if (!response.ok) {
        const t = await response.text()
        lastWhatsappErr = new Error(`Gemini ${response.status}: ${t.slice(0, 200)}`)
        recordAiCall('gemini', 'parse-tx', 'fail')
        httpFailed = true
        continue
      }

      const json = await response.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''

      const result = finalizeParsedTransacao(tryParseJsonBlock(text), message, categoriasUsuario)
      recordAiCall('gemini', 'parse-tx', 'ok')

      // Só cacheia respostas úteis (não CHAT sem info, não erros)
      if (isParsedResultUtil(result)) {
        try { await aiCacheSet(cacheKey, result, AI_CACHE_TTL.parseTransacao) } catch { /* noop */ }
      }
      return result
    } catch (e) {
      if (!httpFailed) {
        // Exceção inesperada no modelo — marca como falha e continua para Groq
        lastWhatsappErr = e
        recordAiCall('gemini', 'parse-tx', 'fail')
      }
    }
  }

  geminiExhausted = true

  // AC6: fallback Groq — dispara quando todos os modelos Gemini falharam (HTTP ou exceção)
  if (geminiExhausted) {
    const groqKey = process.env.GROQ_API_KEY
    if (groqKey) {
      try {
        const groqText = await groqChatCompletion({
          apiKey: groqKey,
          systemPrompt: systemInstruction,
          userMessage,
        })
        const groqParsed = tryParseJsonBlock(groqText)
        if (groqParsed && groqParsed.tipo) {
          log.info('[ai-whatsapp] groq fallback ok', { tipo: groqParsed.tipo })
          const result = finalizeParsedTransacao(groqParsed, message, categoriasUsuario)
          recordAiCall('groq', 'parse-tx', 'ok')
          if (isParsedResultUtil(result)) {
            try { await aiCacheSet(cacheKey, result, AI_CACHE_TTL.parseTransacao) } catch { /* noop */ }
          }
          return result
        }
        recordAiCall('groq', 'parse-tx', 'fail')
      } catch (e) {
        recordAiCall('groq', 'parse-tx', 'fail')
        log.warn('[ai-whatsapp] groq fallback error', e?.message)
      }
    }
  }

  const fallbackFinal = fallbackParseMensagemSimples(message)
  if (fallbackFinal) return enriquecerCategoriaPorTexto(message, fallbackFinal, categoriasUsuario)

  throw lastWhatsappErr || new Error('Falha na IA ao analisar mensagem.')
}

/**
 * Parse de nota de voz → JSON de transação em um único call Gemini.
 * Elimina a etapa separada de transcrição — corta latência pela metade para áudios.
 */
export async function parseWhatsAppAudioDirectWithAI(audioBytes, mimeHint = '', categoriasUsuario, usuarioId) {
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

  const catMap = categoriasUsuario.map((c) => {
    const subs = c.subcategorias.map((s) => `    • "${s.nome}" → ID: ${s.id}`).join('\n')
    return `▸ ${c.tipo} | Categoria: "${c.nome}" → ID: ${c.id}\n${subs}`
  }).join('\n')

  const [tituloExemplos, categoriaExemplos] = await Promise.all([
    buscarExemplosFewShotTitulo(usuarioId),
    buscarExemplosCategoria(usuarioId),
  ])
  const systemInstruction = buildTransactionParseSystemInstruction(catMap, dataHoraAtualSP(), tituloExemplos, categoriaExemplos)

  // WhatsApp envia sempre ogg/opus — limitar candidatos evita tentativas desnecessárias
  const sniffed = sniffAudioMimeFromBuffer(buf)
  const norm = normalizeAudioMimeForGemini(mimeHint)
  const mimes = [...new Set([sniffed, norm, 'audio/ogg', 'audio/webm'].filter(Boolean))].slice(0, 4)

  const models = resolveGeminiModelCandidates()
  let lastErr = null

  modelLoop: for (const mid of models) {
    for (const mime of mimes) {
      const body = {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [
          { inline_data: { mime_type: mime, data: b64 } },
          { text: 'Analise esta nota de voz e retorne o JSON conforme instruído.' },
        ]}],
        generationConfig: buildGeminiGenerationConfig(mid, { maxOutputTokens: 700, temperature: 0.15 }),
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
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''

        const parsed = tryParseJsonBlock(text)
        if (!parsed) {
          lastErr = new Error('Resposta sem JSON válido')
          continue
        }

        return finalizeParsedTransacao(parsed, parsed?.transcricao || '', categoriasUsuario)
      } catch (e) {
        if (e?.message?.includes?.('401')) throw e
        lastErr = e
      }
    }
  }

  // AC4: fallback Groq Whisper — transcreve e reutiliza pipeline de texto (que tem cache + fallback)
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    try {
      const transcricao = await groqTranscribeAudio({
        apiKey: groqKey,
        audio: buf,
        filename: 'audio.ogg',
        mime: mimeHint || 'audio/ogg',
      })
      recordAiCall('groq', 'audio-transcribe', 'ok')
      if (transcricao && transcricao.trim()) {
        return await parseWhatsAppMessageWithAI(transcricao.trim(), categoriasUsuario, usuarioId)
      }
    } catch (e) {
      recordAiCall('groq', 'audio-transcribe', 'fail')
      log.warn({ msg: 'whatsapp_audio_groq_whisper_failed', detail: String(e?.message || e) })
    }
  }

  log.warn({ msg: 'whatsapp_audio_direct_parse_failed', detail: String(lastErr?.message || lastErr) })
  throw lastErr || new Error('Não foi possível processar o áudio.')
}

/**
 * Garante que categoria/subcategoria existem e batem com o tipo.
 */
export function sanitizeTransacaoExtraidaIA(extractedData, categoriasUsuario) {
  if (!extractedData || typeof extractedData !== 'object') return extractedData
  const tipo = extractedData.tipo
  if (tipo === 'CHAT') return extractedData
  if (tipo === 'MULTIPLO') {
    const txs = Array.isArray(extractedData.transacoes) ? extractedData.transacoes : []
    extractedData.transacoes = txs
      .map((t) => sanitizeTransacaoExtraidaIA(t, categoriasUsuario))
      .filter((t) => t && (t.tipo === 'DESPESA' || t.tipo === 'RECEITA') && Number(t.valor) > 0)
    return extractedData
  }
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
    sanitizeParcelamentoRecorrencia(extractedData)
    return extractedData
  }

  if (extractedData.subcategoria_id) {
    const subOk = cat.subcategorias?.some((s) => s.id === extractedData.subcategoria_id)
    if (!subOk) extractedData.subcategoria_id = null
  }
  sanitizeParcelamentoRecorrencia(extractedData)
  return extractedData
}

/**
 * Normaliza parcelamento/recorrência vindos da IA: clamp 2-120, frequência
 * válida e exclusão mútua (parcelamento vence). Campos inválidos viram null.
 */
function sanitizeParcelamentoRecorrencia(extractedData) {
  const np = parseInt(extractedData?.parcelamento?.num_parcelas, 10)
  extractedData.parcelamento = Number.isFinite(np) && np >= 2 && np <= 120
    ? { num_parcelas: np }
    : null

  const qt = parseInt(extractedData?.recorrencia?.quantidade, 10)
  const freq = String(extractedData?.recorrencia?.frequencia || '').toUpperCase()
  extractedData.recorrencia =
    !extractedData.parcelamento &&
    Number.isFinite(qt) && qt >= 2 && qt <= 120 &&
    ['MENSAL', 'SEMANAL', 'ANUAL'].includes(freq)
      ? { quantidade: qt, frequencia: freq }
      : null
}

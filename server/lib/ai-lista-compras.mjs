import './load-env.mjs'
import { log } from './logger.mjs'
import {
  buildGeminiGenerationConfig,
  geminiPostGenerateContent,
  resolveGeminiModelCandidates,
} from './ai/gemini-client.mjs'
import { extractTextFromGeminiResponse, tryParseJsonBlock } from './ai/parsers.mjs'
import { groqChatCompletion } from './ai/groq-client.mjs'
import { aiCacheKey, aiCacheGet, aiCacheSet, AI_CACHE_TTL } from './ai/ai-cache.mjs'
import { recordAiCall, recordCache } from './ai/ai-telemetry.mjs'
import { hojeYmdBrt } from './date-brt.mjs'

const SYSTEM_PROMPT = `Você é um assistente que interpreta mensagens em português brasileiro sobre listas de compras.

Analise a mensagem e retorne APENAS um JSON com a estrutura abaixo — sem texto extra, sem markdown.

INTENTS possíveis:
- "ADICIONAR_ITENS": usuário quer adicionar item(ns) a uma lista existente
- "CRIAR_LISTA": usuário quer criar uma nova lista de compras (PODE já incluir itens iniciais)
- "VER_LISTA": usuário quer ver o conteúdo de uma lista
- "CHAT": mensagem não é sobre lista de compras

CAMPOS:
- "intent": string (um dos 4 acima)
- "lista_nome": nome da lista mencionada (null se não mencionou)
- "itens": array de itens (para ADICIONAR_ITENS e também para CRIAR_LISTA quando o usuário já cita itens)

REGRAS IMPORTANTES:
- Os itens podem vir na mesma linha (separados por vírgula/"e") OU em linhas separadas (uma por linha). Capture TODOS.
- Se o usuário NÃO mencionar o nome da lista, retorne "lista_nome": null — NÃO invente um nome.
- Em CRIAR_LISTA, "lista_nome" é o nome da lista nova; os produtos citados vão em "itens".

Cada item em "itens" deve ter:
- "nome": string (nome do produto, sem quantidade/unidade)
- "quantidade": número (default 1 se não mencionado)
- "unidade": string normalizada — use EXATAMENTE um destes valores:
  "un" (unidade, peça, item), "kg" (quilo, quilograma), "g" (grama),
  "L" (litro), "mL" (mililitro), "cx" (caixa), "pct" (pacote, saquinho, sachê),
  "dz" (dúzia, 12 unidades)

NORMALIZAÇÃO DE QUANTIDADE:
- "meio quilo" → 0.5 kg
- "uma dúzia" → 12 un  (ou 1 dz dependendo do contexto)
- "dois litros" → 2 L
- "trezentos gramas" → 300 g
- "5 pacotes" → 5 pct
- Se não mencionar quantidade → 1

EXEMPLOS:

Entrada: "adiciona 2kg de arroz e 1L de leite na lista Mercado"
Saída: {"intent":"ADICIONAR_ITENS","lista_nome":"Mercado","itens":[{"nome":"arroz","quantidade":2,"unidade":"kg"},{"nome":"leite","quantidade":1,"unidade":"L"}]}

Entrada: "cria uma lista chamada Farmácia"
Saída: {"intent":"CRIAR_LISTA","lista_nome":"Farmácia","itens":[]}

Entrada: "cria a lista Feira com banana, maçã e 1kg de tomate"
Saída: {"intent":"CRIAR_LISTA","lista_nome":"Feira","itens":[{"nome":"banana","quantidade":1,"unidade":"un"},{"nome":"maçã","quantidade":1,"unidade":"un"},{"nome":"tomate","quantidade":1,"unidade":"kg"}]}

Entrada: "quero ver minha lista da feira"
Saída: {"intent":"VER_LISTA","lista_nome":"feira","itens":[]}

Entrada: "coloca 300g de queijo, 6 ovos e uma caixa de suco na lista Mercado"
Saída: {"intent":"ADICIONAR_ITENS","lista_nome":"Mercado","itens":[{"nome":"queijo","quantidade":300,"unidade":"g"},{"nome":"ovos","quantidade":6,"unidade":"un"},{"nome":"suco","quantidade":1,"unidade":"cx"}]}

Entrada (itens em linhas separadas):
"adiciona na lista Mercado:
arroz
feijão
2kg de açúcar"
Saída: {"intent":"ADICIONAR_ITENS","lista_nome":"Mercado","itens":[{"nome":"arroz","quantidade":1,"unidade":"un"},{"nome":"feijão","quantidade":1,"unidade":"un"},{"nome":"açúcar","quantidade":2,"unidade":"kg"}]}

Entrada (sem citar a lista): "adiciona leite e pão"
Saída: {"intent":"ADICIONAR_ITENS","lista_nome":null,"itens":[{"nome":"leite","quantidade":1,"unidade":"un"},{"nome":"pão","quantidade":1,"unidade":"un"}]}

Entrada: "não consigo dormir"
Saída: {"intent":"CHAT","lista_nome":null,"itens":[]}

MENSAGEM DO USUÁRIO:`

/** Normaliza e valida o objeto de resultado de lista de compras. */
function normalizeListaResult(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  const intent = String(parsed.intent || 'CHAT')
  const lista_nome = parsed.lista_nome ? String(parsed.lista_nome).trim() : null
  const itens = Array.isArray(parsed.itens)
    ? parsed.itens
        .filter((i) => i && typeof i.nome === 'string' && i.nome.trim())
        .map((i) => ({
          nome: String(i.nome).trim(),
          quantidade: Number(i.quantidade) > 0 ? Number(i.quantidade) : 1,
          unidade: ['un','kg','g','L','mL','cx','pct','dz'].includes(String(i.unidade))
            ? String(i.unidade)
            : 'un',
        }))
    : []
  return { intent, lista_nome, itens }
}

/**
 * Interpreta uma mensagem de WhatsApp sobre lista de compras via Gemini.
 * @param {string} message
 * @param {string} [usuarioId]
 * @returns {Promise<{ intent: string, lista_nome: string|null, itens: Array<{nome:string,quantidade:number,unidade:string}> }>}
 */
export async function parseListaComprasMessage(message, usuarioId) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  // Cache: chave inclui data BRT para não vazar "hoje/ontem"
  const cacheKey = aiCacheKey('lista', message.trim().toLowerCase(), hojeYmdBrt(), usuarioId ?? '')
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

  const userContent = `${SYSTEM_PROMPT} "${message}"`
  const models = resolveGeminiModelCandidates()
  let lastErr = null

  for (const mid of models) {
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }],
        },
      ],
      generationConfig: buildGeminiGenerationConfig(mid, {
        maxOutputTokens: 512,
        temperature: 0.1,
      }),
    }

    try {
      const response = await geminiPostGenerateContent(mid, apiKey, body)
      if (!response.ok) {
        const t = await response.text()
        lastErr = new Error(`Gemini ${response.status}: ${t?.slice(0, 400)}`)
        recordAiCall('gemini', 'lista', 'fail')
        if (response.status === 401) throw lastErr
        continue
      }

      const json = await response.json()
      const extracted = extractTextFromGeminiResponse(json)
      if (!extracted.ok) {
        lastErr = new Error(extracted.detail || 'Resposta vazia Gemini')
        recordAiCall('gemini', 'lista', 'fail')
        continue
      }

      const parsed = normalizeListaResult(tryParseJsonBlock(extracted.text))
      if (!parsed) {
        lastErr = new Error('JSON inválido na resposta Gemini')
        recordAiCall('gemini', 'lista', 'fail')
        continue
      }

      recordAiCall('gemini', 'lista', 'ok')
      try { await aiCacheSet(cacheKey, parsed, AI_CACHE_TTL.listaCompras) } catch { /* noop */ }
      return parsed
    } catch (e) {
      if (e?.message?.includes?.('401')) throw e
      recordAiCall('gemini', 'lista', 'fail')
      lastErr = e
    }
  }

  // Fallback Groq quando todos os modelos Gemini falharam
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    try {
      const groqText = await groqChatCompletion({
        apiKey: groqKey,
        systemPrompt: SYSTEM_PROMPT,
        userMessage: `"${message}"`,
        maxTokens: 512,
        temperature: 0.1,
      })
      const parsed = normalizeListaResult(tryParseJsonBlock(groqText))
      if (parsed) {
        log.info('[ai-lista-compras] groq fallback ok', { intent: parsed.intent })
        recordAiCall('groq', 'lista', 'ok')
        try { await aiCacheSet(cacheKey, parsed, AI_CACHE_TTL.listaCompras) } catch { /* noop */ }
        return parsed
      }
      recordAiCall('groq', 'lista', 'fail')
    } catch (e) {
      recordAiCall('groq', 'lista', 'fail')
      log.warn('[ai-lista-compras] groq fallback error', e?.message)
    }
  }

  log.warn('[ai-lista-compras] parseListaComprasMessage failed', String(lastErr?.message || lastErr))
  if (lastErr) throw lastErr
  throw new Error('Não foi possível interpretar a mensagem de lista de compras.')
}

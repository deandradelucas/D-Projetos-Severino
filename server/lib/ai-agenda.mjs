import './load-env.mjs'
import { log } from './logger.mjs'
import { draftAgendaFromTextHeuristic, snapReminderToAppOptions } from './domain/agenda-whatsapp.mjs'
import {
  buildGeminiGenerationConfig,
  geminiPostGenerateContent,
  resolveGeminiModelCandidates,
} from './ai/gemini-client.mjs'
import { tryParseJsonBlock } from './ai/parsers.mjs'

const TRAILING_STOPWORDS = /[\s,;.]+(?:para|de|do|da|dos|das|com|a|ao|aos|às|e|ou|que|um|uma|o|os|as|no|na|nos|nas|pelo|pela|pelos|pelas|num|numa|por|sem|sob|sobre|até|após|ante|perante|entre|contra|durante|mediante|exceto|salvo|conforme|segundo)\s*[.,;]*$/i

function sanitizeTitulo(raw) {
  let t = raw.replace(/[.,;]+$/, '').trim()
  // remove trailing stopwords repetidamente até estabilizar
  let prev
  do {
    prev = t
    t = t.replace(TRAILING_STOPWORDS, '').trim()
  } while (t !== prev)
  return (t.slice(0, 160) || 'Compromisso')
}

/**
 * Interpreta texto livre para preencher o formulário da agenda (web). Usa Gemini com fallback heurístico (mesmo núcleo do WhatsApp).
 */
export async function parseAgendaFromTextWithAI(texto, baseDate = new Date()) {
  const trimmed = String(texto || '').trim()
  if (!trimmed) throw new Error('Texto vazio.')

  const fallback = () => draftAgendaFromTextHeuristic(trimmed, baseDate)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const h = fallback()
    if (h) return h
    throw new Error('GEMINI_API_KEY não configurada e não foi possível interpretar só com regras locais.')
  }

  const base = baseDate instanceof Date ? baseDate : new Date(baseDate)
  const baseReadable = base.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const safeUserText = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  const instruction =
    'Você interpreta pedidos em português brasileiro para preencher um formulário de agenda (compromisso ou lembrete).\n\n' +
    `REFERÊNCIA DE DATA/HORA no fuso America/Sao_Paulo: ${baseReadable}\n\n` +
    'Retorne APENAS um JSON válido (sem markdown), formato exato:\n' +
    '{"titulo":"string","data_local":"YYYY-MM-DD","hora_local":"HH:mm","local":"","descricao":"","lembrar_minutos_antes":15,"whatsapp_notificar":true}\n\n' +
    'Regras gerais:\n' +
    '- data_local e hora_local são no horário de Brasília (não use UTC no JSON).\n' +
    '- lembrar_minutos_antes deve ser exatamente um destes valores: 0, 5, 10, 15, 30, 60.\n' +
    '- Se o texto pedir lembrete/aviso sem especificar quantos minutos antes, use 15.\n' +
    '- whatsapp_notificar: true, salvo pedido explícito para não notificar.\n' +
    '- local e descricao: strings, podem ser vazias.\n' +
    '- HORÁRIO AMBÍGUO: horas de 1 a 6 sem qualificador explícito ("da manhã", "da tarde", "da noite") devem ser interpretadas como tarde/noite (some 12). Ex: "às 5 horas" → 17:00, "às 3 horas" → 15:00, "às 5 da manhã" → 05:00.\n\n' +
    'Regras para o TÍTULO:\n' +
    '- Use de 2 a 6 palavras. Capitalize a primeira letra.\n' +
    '- VERBOS DE AGENDAMENTO a remover do início: marcar, agendar, agenda, criar, adicionar, anotar, anota, colocar, coloca, bota, salva, registra, me lembra de, lembrar de, avise, lembre, tenho, terei.\n' +
    '- MANTENHA: verbos que descrevem o evento (pagar, buscar, ir, ligar, levar, chamar, comprar, tomar, buscar, pegar), artigos e preposições que fazem parte natural da frase.\n' +
    '- Ignore preamble conversacional (saudações, "oi", "tudo bem?", "Fala Severino") antes do comando de agendamento.\n' +
    '- NUNCA termine o título com preposição, artigo ou conjunção solta (para, de, do, da, com, a, ao, aos, às, e, ou, que, um, uma, o, os, as). Se o complemento não estiver claro, omita a preposição.\n' +
    '- NUNCA inclua pontuação no final do título (ponto, vírgula, ponto e vírgula, reticências).\n' +
    '- Se o usuário só informar horário sem descrever o evento, use "Compromisso" como título.\n' +
    '- Erros de digitação comuns (corrigir silenciosamente no título): "reuiao"→"reunião", "dentitas"→"dentista", "exeme"→"exame", "vascina"→"vacina", "medico"→"médico".\n' +
    '- Exemplos de entrada → título correto:\n' +
    '  "marcar dentista segunda 10h" → "Dentista"\n' +
    '  "Fala Severino, como você tá? Marque uma reunião importante para as 16:30" → "Reunião importante"\n' +
    '  "reunião para o cliente amanhã 15h" → "Reunião com cliente"\n' +
    '  "reunião para . 15h" → "Reunião"\n' +
    '  "lembrar de ir buscar a Fabiana às dezesseis e meia" → "Ir buscar a Fabiana"\n' +
    '  "Oi, tudo bem? Agenda uma consulta médica pra amanhã às 9h" → "Consulta médica"\n' +
    '  "me lembra de pagar a luz sexta 9h" → "Pagar a luz"\n' +
    '  "amanhã às quinze e meia buscar filha na escola" → "Buscar filha na escola"\n' +
    '  "call com cliente às dezesseis horas" → "Call com cliente"\n' +
    '  "ligar para o contador amanhã 9h" → "Ligar para o contador"\n' +
    '  "levar os filhos na escola segunda 7h30" → "Levar os filhos na escola"\n' +
    '  "coloca aí vacina do João quinta" → "Vacina do João"\n' +
    '  "bota na agenda treino quarta 6h" → "Treino"\n' +
    '  "salva aqui aniversário da Ana sábado" → "Aniversário da Ana"\n' +
    '  "registra consulta médico sexta 15h" → "Consulta médico"\n' +
    '  "tenho exame de sangue segunda 7h" → "Exame de sangue"\n' +
    '  "terei reunião com a equipe quinta 14h" → "Reunião com a equipe"\n' +
    '  "preciso pegar o carro na oficina amanhã 10h" → "Pegar carro na oficina"\n' +
    '  "pagar boleto da academia até sexta" → "Pagar boleto academia"\n\n' +
    `Texto do usuário:\n"""${safeUserText}"""`

  const models = resolveGeminiModelCandidates()
  let lastErr = null

  for (const mid of models) {
    try {
      const response = await geminiPostGenerateContent(mid, apiKey, {
        contents: [{ role: 'user', parts: [{ text: instruction }] }],
        generationConfig: buildGeminiGenerationConfig(mid, { maxOutputTokens: 400, temperature: 0.15 }),
      })
      if (!response.ok) {
        const t = await response.text()
        lastErr = new Error(`Gemini ${response.status}: ${t.slice(0, 200)}`)
        continue
      }
      const json = await response.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const parsed = tryParseJsonBlock(text)
      if (!parsed || typeof parsed !== 'object') {
        lastErr = new Error('JSON inválido na resposta da IA.')
        continue
      }
      const titulo = sanitizeTitulo(String(parsed.titulo || '').trim())
      const dl = String(parsed.data_local || '').trim()
      const hlRaw = String(parsed.hora_local || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dl) || !/^\d{1,2}:\d{2}$/.test(hlRaw)) {
        lastErr = new Error('data_local ou hora_local inválidos na resposta da IA.')
        continue
      }
      const [hh, mm] = hlRaw.split(':').map((x) => Number.parseInt(x, 10))
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) {
        lastErr = new Error('hora inválida na resposta da IA.')
        continue
      }
      const hlNorm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
      const iso = new Date(`${dl}T${hlNorm}:00-03:00`)
      if (Number.isNaN(iso.getTime())) {
        lastErr = new Error('Combinação data/hora inválida.')
        continue
      }
      let lem = Number.parseInt(String(parsed.lembrar_minutos_antes), 10)
      if (![0, 5, 10, 15, 30, 60].includes(lem)) lem = snapReminderToAppOptions(lem)

      return {
        titulo,
        descricao: String(parsed.descricao || '').trim().slice(0, 1000),
        local: String(parsed.local || '').trim().slice(0, 180),
        inicio: iso.toISOString(),
        lembrar_minutos_antes: lem,
        whatsapp_notificar: parsed.whatsapp_notificar !== false,
        origem: 'ia',
      }
    } catch (e) {
      lastErr = e
    }
  }

  log.warn('[parseAgendaFromTextWithAI] usando fallback heurístico', lastErr?.message || lastErr)
  const h = fallback()
  if (h) return h
  throw lastErr || new Error('Não foi possível interpretar o texto da agenda.')
}

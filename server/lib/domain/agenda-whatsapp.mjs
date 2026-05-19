import {
  atualizarAgendaEvento,
  atualizarAgendaStatus,
  criarAgendaEvento,
  formatAgendaDateTime,
  listarAgendaEventos,
  registrarInteracaoAgendaWhatsApp,
  ultimoEventoAgendaCriadoRecentemente,
  AGENDA_TZ,
} from './agenda.mjs'
import { assertFamiliaPodeEscrever } from '../conta-familiar.mjs'

const AGENDA_KEYWORD_RE =
  /\b(agenda|compromisso|compromissos|reuni[aã]o|reuniao|evento|consulta|consult[óo]rio|dentista|m[eé]dico|agendar|marcar|anotar|anota|cancelar|desmarcar|reagendar|remarcar|confirmar|concluir|finalizar|lembrete|lembra|lembrar|lembre|avise|avisar|alerte|alerta|alertar)\b/i
const CREATE_INTENT_RE =
  /\b(marcar|agendar|criar|adicionar|anotar|anota|colocar|inclui|incluir|tenho|terei|lembrete|lembra|lembrar|lembre|avise|avisar|alerte|alerta|alertar|consulta|reuni[aã]o|reuniao|evento|compromisso|dentista|m[eé]dico)\b/i

const WEEKDAY_MAP = new Map([
  ['domingo', 0],
  ['segunda', 1],
  ['terça', 2],
  ['terca', 2],
  ['quarta', 3],
  ['quinta', 4],
  ['sexta', 5],
  ['sábado', 6],
  ['sabado', 6],
  // Abreviações (3 letras) — verificadas com \b para não colidir com palavras maiores
  ['dom', 0],
  ['seg', 1],
  ['ter', 2],
  ['qua', 3],
  ['qui', 4],
  ['sex', 5],
  ['sab', 6],
])

function pad2(value) {
  return String(value).padStart(2, '0')
}

/**
 * Retorna o offset UTC atual de America/Sao_Paulo como string "+HH:MM" ou "-HH:MM".
 * Lida corretamente com BRST (-02:00) e BRT (-03:00).
 */
function saoPauloOffset(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AGENDA_TZ,
    timeZoneName: 'shortOffset',
  }).formatToParts(date)
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-3'
  const m = raw.match(/GMT([+-])(\d+)(?::(\d+))?/)
  if (!m) return '-03:00'
  return `${m[1]}${m[2].padStart(2, '0')}:${(m[3] || '0').padStart(2, '0')}`
}

function saoPauloParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AGENDA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  const key = `${get('year')}-${get('month')}-${get('day')}`
  const weekdayName = String(get('weekday') || '').toLowerCase()
  const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(weekdayName.slice(0, 3))
  // Fallback: key já é data local SP; noon UTC garante mesmo dia calendário sem depender de offset fixo
  return {
    year: Number.parseInt(get('year'), 10),
    month: Number.parseInt(get('month'), 10),
    day: Number.parseInt(get('day'), 10),
    key,
    weekday: weekday >= 0 ? weekday : new Date(`${key}T12:00:00Z`).getUTCDay(),
  }
}

function saoPauloDateFromParts({ year, month, day, hour = 0, minute = 0 }) {
  // Usa noon UTC do dia-alvo como referência para derivar o offset correto (BRT ou BRST)
  const ref = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const offset = saoPauloOffset(ref)
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00${offset}`)
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Normaliza horas/minutos por extenso em portugu\u00eas para formato num\u00e9rico.
 * "dezesseis e meia" \u2192 "16:30" | "\u00e0s quatorze horas" \u2192 "\u00e0s 14 horas"
 * Seguro: compostos resolvidos antes dos simples; amb\u00edguos s\u00f3 com preposi\u00e7\u00e3o ou "horas".
 */
function normalizeWordTime(text) {
  let t = String(text || '')
  const r = (re, val) => { t = t.replace(re, val) }

  // Compostos PRIMEIRO (evita match parcial em "vinte e dois" \u2192 "20 e dois")
  r(/\bvinte\s+e\s+tr[e\u00ea]s\b/gi, '23')
  r(/\bvinte\s+e\s+dois\b|\bvinte\s+e\s+duas\b/gi, '22')
  r(/\bvinte\s+e\s+um\b|\bvinte\s+e\s+uma\b/gi, '21')

  // Un\u00edvocos (11-20) \u2014 substitui\u00e7\u00e3o direta, raramente amb\u00edguos em contexto de agenda
  r(/\bdezenove\b|\bdezanove\b/gi, '19')
  r(/\bdezoito\b/gi, '18')
  r(/\bdezessete\b|\bdezassete\b/gi, '17')
  r(/\bdezesseis\b|\bdezasseis\b/gi, '16')
  r(/\bquinze\b/gi, '15')
  r(/\bquatorze\b|\bcatorze\b/gi, '14')
  r(/\btreze\b/gi, '13')
  r(/\bdoze\b/gi, '12')
  r(/\bonze\b/gi, '11')
  r(/\bvinte\b/gi, '20')

  // Amb\u00edguos (1-10): somente com preposi\u00e7\u00e3o (\u00e0s/as/pelas) OU seguidos de "horas"
  for (const [pat, val] of [
    ['dez', 10], ['nove', 9], ['oito', 8], ['sete', 7],
    ['seis', 6], ['cinco', 5], ['quatro', 4], ['tr[e\u00ea]s', 3],
    ['dois|duas', 2],
  ]) {
    r(new RegExp(`(\\b(?:\u00e0s|as|pelas?)\\s+)(?:${pat})\\b`, 'gi'), `$1${val}`)
    r(new RegExp(`\\b(?:${pat})(?=\\s+horas?\\b)`, 'gi'), String(val))
  }
  r(/((?:\u00e0s|as|pelas?)\s+)uma\b/gi, '$11')
  r(/\buma\s+hora\b/gi, '1h')

  // Minutos por extenso ap\u00f3s d\u00edgito (maiores combina\u00e7\u00f5es primeiro)
  r(/\b(\d{1,2})\s+e\s+quarenta\s+e\s+cinco\b/gi, '$1:45')
  r(/\b(\d{1,2})\s+e\s+trinta\s+e\s+cinco\b/gi, '$1:35')
  r(/\b(\d{1,2})\s+e\s+vinte\s+e\s+cinco\b/gi, '$1:25')
  r(/\b(\d{1,2})\s+e\s+quarenta\b/gi, '$1:40')
  r(/\b(\d{1,2})\s+e\s+trinta\b/gi, '$1:30')
  r(/\b(\d{1,2})\s+e\s+vinte\b/gi, '$1:20')
  r(/\b(\d{1,2})\s+e\s+quinze\b/gi, '$1:15')
  r(/\b(\d{1,2})\s+e\s+dez\b/gi, '$1:10')
  r(/\b(\d{1,2})\s+e\s+cinco\b/gi, '$1:05')
  r(/\b(\d{1,2})\s+e\s+meia\b/gi, '$1:30')

  return t
}

function startOfToday() {
  const parts = saoPauloParts()
  return saoPauloDateFromParts(parts)
}

function endOfToday() {
  const parts = saoPauloParts()
  const d = saoPauloDateFromParts({ ...parts, hour: 23, minute: 59 })
  d.setUTCSeconds(59, 999)
  return d
}

function addDays(base, days) {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function nextWeekday(targetDay) {
  const d = startOfToday()
  const current = saoPauloParts(d).weekday
  let delta = targetDay - current
  if (delta <= 0) delta += 7
  return addDays(d, delta)
}

function parseTime(message) {
  const text = String(message || '').toLowerCase()

  // Palavras-chave sem número explícito
  if (/\bmeio[\s-]dia\b/.test(text)) return { hour: 12, minute: 0 }
  if (/\bmeia[\s-]noite\b/.test(text)) return { hour: 0, minute: 0 }

  // "14 e meia" / "14 horas e meia" → :30
  const eMeia = text.match(/\b(?:(?:às|as|pelas?)\s*)?(\d{1,2})(?:\s+horas?)?\s+e\s+meia\b/i)
  if (eMeia) {
    let h = Number.parseInt(eMeia[1], 10)
    if (Number.isFinite(h) && h >= 0 && h <= 23) {
      if (h >= 1 && h <= 11 && /\b(da|de)?\s*(tarde|noite)\b/.test(text)) h += 12
      return { hour: h, minute: 30 }
    }
  }

  const match = text.match(
    /\b(?:às|as|pelas?)\s*(\d{1,2})(?:[:h](\d{2}))?\b|\bpara\s+as\s+(\d{1,2})(?:[:h](\d{2}))?\b|\b(?:a|para)\s+(\d{1,2})(?:[:h](\d{2}))?\b|\b(\d{1,2})[:h](\d{2})\b|\b(\d{1,2})h\b|\b(\d{1,2})\s+horas?\b/i
  )
  if (!match) return null

  // índices: às/as/pelas → 1,2 | para as → 3,4 | a/para → 5,6 | HH:mm → 7,8 | HHh → 9 | N horas → 10
  let hour = Number.parseInt(match[1] || match[3] || match[5] || match[7] || match[9] || match[10], 10)
  const minute = Number.parseInt(match[2] || match[4] || match[6] || match[8] || '0', 10)

  if (!Number.isFinite(hour)) return null
  if (hour >= 1 && hour <= 11 && /\b(da|de)?\s*(tarde|noite)\b/.test(text)) hour += 12
  if (hour >= 1 && hour <= 6 && /\b(da|de|pela)?\s*manh[aã]\b/.test(text)) {
    // "6 da manhã" — já está correto, nenhum ajuste necessário (hora < 12)
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

export function parseAgendaDateTime(message, base = new Date()) {
  const raw = String(message || '')
  const text = normalizeWordTime(stripAccents(raw.toLowerCase()))
  const time = parseTime(text)

  const relative = text.match(/\b(?:daqui\s+a|em)\s+(\d{1,3})\s*(min|minuto|minutos|hora|horas|h|dia|dias|semana|semanas)\b/)
  if (relative) {
    const amount = Number.parseInt(relative[1], 10)
    const unit = relative[2]
    if (!Number.isFinite(amount)) return null
    const d = new Date(base)
    if (unit.startsWith('min')) d.setUTCMinutes(d.getUTCMinutes() + amount)
    else if (unit.startsWith('h') || unit.startsWith('hora')) d.setUTCHours(d.getUTCHours() + amount)
    else if (unit.startsWith('dia')) d.setUTCDate(d.getUTCDate() + amount)
    else if (unit.startsWith('semana')) d.setUTCDate(d.getUTCDate() + amount * 7)
    return d
  }

  if (!time) return null

  let parts = saoPauloParts(base)
  /** Só horário no texto → assume calendário “hoje” em SP; se esse instante já passou, usa o dia seguinte. */
  let bumpDayIfPast = true

  const explicitDate = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (explicitDate) {
    bumpDayIfPast = false
    const day = Number.parseInt(explicitDate[1], 10)
    const month = Number.parseInt(explicitDate[2], 10)
    let year = explicitDate[3] ? Number.parseInt(explicitDate[3], 10) : parts.year
    if (year < 100) year += 2000
    parts = { year, month, day }
  } else if (text.includes('depois de amanha')) {
    bumpDayIfPast = false
    parts = saoPauloParts(addDays(startOfToday(), 2))
  } else if (text.includes('amanha')) {
    bumpDayIfPast = false
    parts = saoPauloParts(addDays(startOfToday(), 1))
  } else if (text.includes('hoje')) {
    // "hoje" é explícito — nunca empurra para amanhã mesmo se horário passou
    bumpDayIfPast = false
    parts = saoPauloParts(startOfToday())
  } else {
    let weekdayMatched = false
    for (const [name, weekday] of WEEKDAY_MAP.entries()) {
      // Abreviações (≤3 chars) usam \b para não casar dentro de palavras maiores
      const matched = name.length <= 3
        ? new RegExp(`\\b${name}\\b`).test(text)
        : text.includes(name)
      if (matched) {
        parts = saoPauloParts(nextWeekday(weekday))
        weekdayMatched = true
        break
      }
    }
    if (weekdayMatched) bumpDayIfPast = false
  }

  let result = saoPauloDateFromParts({ ...parts, hour: time.hour, minute: time.minute })
  if (bumpDayIfPast && result.getTime() < base.getTime()) {
    result = addDays(result, 1)
  }
  return result
}

/** Indica que "… para/as HH horas antes …" é horário (às HH), não pedido de aviso "HH horas antes". */
function isLikelyClockAtPhraseBeforeHourOffset(before) {
  const b = String(before || '').trimEnd()
  return (
    /\bpara\s+as\s*$/i.test(b) ||
    /\breuni[aã]o\s+para\s+as\s*$/i.test(b) ||
    /\breuniao\s+para\s+as\s*$/i.test(b) ||
    /\breuni[aã]o\s+as\s*$/i.test(b) ||
    /\breuniao\s+as\s*$/i.test(b) ||
    /\b(?:marcar|agendar|criar|anotar|tenho|terei)\s+\S+(?:\s+\S+)*\s+as\s*$/i.test(b)
  )
}

export function parseReminderMinutes(message) {
  const text = stripAccents(String(message || '').toLowerCase())
  const match = text.match(
    /\b(?:avise|avisar|alerte|alerta|alertar|lembre|lembrar|lembra|lembrete).*?(\d{1,4})\s*(min|minuto|minutos|hora|horas|h)\s+antes\b|\b(\d{1,4})\s*(min|minuto|minutos|hora|horas|h)\s+antes\b/
  )
  if (!match || match.index === undefined) return null
  const n = Number.parseInt(match[1] || match[3], 10)
  if (!Number.isFinite(n)) return null
  const unit = match[2] || match[4]
  const isHourUnit = unit.startsWith('h') || unit.startsWith('hora')
  if (isHourUnit && isLikelyClockAtPhraseBeforeHourOffset(text.slice(0, match.index))) return null
  return Math.min(unit.startsWith('h') || unit.startsWith('hora') ? n * 60 : n, 1440)
}

/** Conta palavras com 2+ caracteres (exclui artigos soltos de 1 letra). */
function wordCount(text) {
  return String(text || '').split(/\s+/).filter(w => w.length >= 2).length
}

/** Remove marcadores de data/hora de um texto. Reutilizado em dois contextos. */
function stripDateTime(text) {
  let t = text
  t = t.replace(/\bmeio[\s-]dia\b/gi, '')
  t = t.replace(/\bmeia[\s-]noite\b/gi, '')
  t = t.replace(/\b(?:depois\s+de\s+amanh[aã]|amanh[aã]|hoje)(?!\w)/gi, '')
  t = t.replace(/\b(?:segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[aá]bado|domingo|seg|ter|qua|qui|sex|sab|dom)\.?(?!\w)/gi, '')
  t = t.replace(/\b(?:daqui\s+a|em)\s+\d{1,3}\s*(?:min|minuto|minutos|hora|horas|h|dia|dias|semana|semanas)\b/gi, '')
  t = t.replace(/\b(?:dia\s+)?\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/gi, '')
  t = t.replace(/(?<!\w)(?:às|as|pelas?)\s*\d{1,2}(?:h\d{2}|:\d{2}|\s+horas?\s+e\s+meia|\s+horas?|h)?(?=\s|$|[^\w])/gi, '')
  t = t.replace(/\bpara\s+(?:as|às)\s+\d{1,2}(?:[:h]\d{2}|\s+horas?\s+e\s+meia|\s+horas?)?\b/gi, '')
  t = t.replace(/\b\d{1,2}[:h]\d{2}\b/gi, '')
  t = t.replace(/\b\d{1,2}\s+horas?\s+e\s+meia\b/gi, '')
  t = t.replace(/\b\d{1,2}\s+e\s+meia\b/gi, '')
  t = t.replace(/\b\d{1,2}\s+horas?\b/gi, '')
  t = t.replace(/\b\d{1,2}h\b/gi, '')
  t = t.replace(/\b(?:da|de|pela)\s+(?:manh[aã]|tarde|noite)\b/gi, '')
  t = t.replace(/\b(?:pr[oó]xim[ao]s?)\b/gi, '')
  return t
}

/**
 * Extração leve: remove só o verbo de agendamento no início e marcadores de data/hora.
 * Preserva verbos de ação (pagar, buscar, ir...), artigos e preposições.
 * Usado como fallback quando a extração completa produz < 3 palavras.
 */
function lightExtractTitle(message) {
  let text = normalizeWordTime(String(message || '').trim())

  // Remove "Severino"
  if (/^.{0,60}severino\b/i.test(text)) {
    text = text.replace(/^.*?\bseverino\b[,!\s]*/i, '')
  }

  // Salta para o verbo de agendamento se houver preamble conversacional
  const schedVerb =
    /\b(?:me\s+)?(?:marqu[ae]|agende?|cri[ae](?=\s)|adicione?|anote?(?=\s)|coloque?|inclua?|lembr[ae](?:\s+(?:de|que|disso))?|avis[ae](?:\s+(?:de|me))?|alert[ae](?:\s+(?:de|me))?|lembrete\s+de|marcar?\s|agendar?\s)/i
  const schedMatch = text.match(schedVerb)
  if (schedMatch && schedMatch.index > 0) text = text.slice(schedMatch.index)

  // Remove verbo de agendamento no início + conector opcional (exige espaço após conector para não cortar palavras como "dentista")
  text = text.replace(
    /^(?:me\s+)?(?:marcar|marque|agendar|agende|criar|crie|adicionar|adicione|anotar|anote|anota|colocar|coloque|inclui|incluir|inclua|avise?|avisar|alerte?|alertar|lembra|lembrar|lembre|tenho|terei|lembrete)\s+(?:(?:de|para|um|uma|o|a)\s+)*/i,
    ''
  )

  // Remove frases de lembrete ao final
  text = text.replace(/[\s,]+\b(?:me\s+)?(?:avise|avisar|alerte|alerta|alertar|lembre|lembrar|lembra)\b.*$/i, '')

  // Remove marcadores de data/hora
  text = stripDateTime(text)

  // Retorna até 6 palavras (preserva verbos, artigos, preposições intactos)
  return stripTrailingStopwords(
    text
      .replace(/\s+/g, ' ')
      .replace(/^[\s,;:?!.]+|[\s,;:?!.]+$/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 6)
      .join(' ')
  )
}

const _TRAILING_SW = /[\s,;.]*(para|de|do|da|dos|das|com|a|ao|aos|às|e|ou|que|um|uma|o|os|as|no|na|nos|nas|pelo|pela|pelos|pelas|num|numa|por|sem|sob|sobre|até|após|ante|entre|contra|durante|sem)\s*[.,;]*$/i

function stripTrailingStopwords(t) {
  let s = t.replace(/[.,;]+$/, '').trim()
  let prev
  do { prev = s; s = s.replace(_TRAILING_SW, '').trim() } while (s !== prev)
  return s
}

function extractTitle(message) {
  // 1. Normaliza horas por extenso
  let text = normalizeWordTime(String(message || '').trim())

  // 2. Remove "Severino" (vocativo em qualquer posição dentro dos primeiros 60 chars)
  if (/^.{0,60}severino\b/i.test(text)) {
    text = text.replace(/^.*?\bseverino\b[,!\s]*/i, '')
  }

  // 3. Localiza verbo de agendamento em QUALQUER posição; salta preamble conversacional
  const schedVerb =
    /\b(?:me\s+)?(?:marqu[ae]|agende?|cri[ae](?=\s)|adicione?|anote?(?=\s)|coloque?|inclua?|lembr[ae](?:\s+(?:de|que|disso))?|avis[ae](?:\s+(?:de|me))?|alert[ae](?:\s+(?:de|me))?|lembrete\s+de|marcar?\s|agendar?\s)/i
  const schedMatch = text.match(schedVerb)
  if (schedMatch && schedMatch.index > 0) {
    text = text.slice(schedMatch.index)
  }

  // 4. Remove verbos de agendamento no início (infinitivo + imperativo)
  // Conector com espaço obrigatório evita cortar palavras como "dentista" (não absorver "de" de "de+ntista")
  text = text.replace(
    /^(?:me\s+)?(?:marcar|marque|agendar|agende|criar|crie|adicionar|adicione|anotar|anote|anota|colocar|coloque|inclui|incluir|inclua|avise?|avisar|alerte?|alertar|lembra|lembrar|lembre|tenho|terei|lembrete)\s+(?:(?:de|para|um|uma|o|a)\s+)*/i,
    ''
  )
  text = text.replace(/^(?:um|uma|o|a)\s+(?:compromisso|lembrete|evento)\s+(?:de|para)?\s*/i, '')

  // 5. Remove frases de lembrete ao final
  text = text.replace(/[\s,]+\b(?:me\s+)?(?:avise|avisar|alerte|alerta|alertar|lembre|lembrar|lembra)\b.*$/i, '')

  // 6. Remove marcadores de data/hora em QUALQUER posição
  text = stripDateTime(text)

  // 7. Limpa e mede resultado
  const cleaned = stripTrailingStopwords(text.replace(/\s+/g, ' ').replace(/^[\s,;:?!.]+|[\s,;:?!.]+$/g, '').trim())

  // 8. Fallback: se resultado tem < 3 palavras, usa extração leve (preserva verbos/artigos)
  if (wordCount(cleaned) < 3) {
    const light = lightExtractTitle(message)
    if (wordCount(light) > wordCount(cleaned) && light.length > 1) {
      return (light.charAt(0).toUpperCase() + light.slice(1)).slice(0, 160)
    }
  }

  if (cleaned.length < 2) return 'Compromisso'
  return (cleaned.charAt(0).toUpperCase() + cleaned.slice(1)).slice(0, 160)
}

function isReminderCreateMessage(message) {
  return /\b(me\s+)?(lembra|lembrar|lembre|avise|avisar|alerte|alerta|alertar|lembrete)\b/i.test(String(message || ''))
}

function titleForCreate(message) {
  const title = extractTitle(message)
  if (!isReminderCreateMessage(message)) return title
  if (/^(compromisso|quando for|quando der|na hora)$/i.test(title)) return 'Notificação'
  return title
}

function hasCreateIntent(message) {
  const text = String(message || '')
  return CREATE_INTENT_RE.test(text) || /\b(me\s+)?(lembra|avise|alerte)\s+de\b/i.test(text)
}

function formatReminderLabel(minutes) {
  const n = Number.parseInt(String(minutes ?? 0), 10)
  if (!Number.isFinite(n) || n <= 0) return 'na hora marcada'
  if (n % 60 === 0) {
    const horas = n / 60
    return `${horas} ${horas === 1 ? 'hora' : 'horas'} antes`
  }
  return `${n} min antes`
}

/** Opções do select no app web (minutos antes). */
const REMINDER_OPTIONS_APP = [0, 5, 10, 15, 30, 60]

/**
 * Aproxima minutos pedidos para o valor mais próximo permitido no formulário da agenda (web).
 */
export function snapReminderToAppOptions(minutes) {
  const n = Number.parseInt(String(minutes ?? 15), 10)
  if (!Number.isFinite(n)) return 15
  const clamped = Math.min(Math.max(n, 0), 1440)
  return REMINDER_OPTIONS_APP.reduce(
    (best, v) => (Math.abs(v - clamped) < Math.abs(best - clamped) ? v : best),
    15,
  )
}

/**
 * Rascunho para o modal da agenda (app) ou fallback quando a IA falha.
 * Reutiliza o mesmo interpretador de data/hora do WhatsApp.
 */
export function draftAgendaFromTextHeuristic(message, base = new Date()) {
  const inicio = parseAgendaDateTime(message, base)
  if (!inicio) return null
  const titulo = titleForCreate(message)
  const remFromText = parseReminderMinutes(message)
  const lembrar_minutos_antes = snapReminderToAppOptions(remFromText ?? 15)
  const reminderCreate = isReminderCreateMessage(message)
  return {
    titulo,
    descricao: reminderCreate ? '' : '',
    local: '',
    inicio: inicio.toISOString(),
    lembrar_minutos_antes,
    whatsapp_notificar: true,
    origem: 'heuristica',
  }
}

function formatLista(eventos, titulo = 'Agenda') {
  if (!eventos.length) return `🗓️ *${titulo}*\n\nNenhum compromisso encontrado.`
  const lines = eventos.slice(0, 8).map((ev, idx) => {
    const local = ev.local ? `\n   📍 ${ev.local}` : ''
    return `${idx + 1}. *${ev.titulo}*\n   ${formatAgendaDateTime(ev.inicio, ev.timezone || AGENDA_TZ)}${local}`
  })
  return `🗓️ *${titulo}*\n\n${lines.join('\n\n')}\n\nComandos: *confirmar 1*, *reagendar 1 para amanhã 10h*, *cancelar 1*.`
}

async function listarProximos(usuarioId, onlyToday = false) {
  const from = onlyToday ? startOfToday() : new Date()
  const to = onlyToday ? endOfToday() : addDays(new Date(), 30)
  return listarAgendaEventos(usuarioId, { from: from.toISOString(), to: to.toISOString() })
}

async function resolveEvento(usuarioId, token) {
  const eventos = await listarProximos(usuarioId, false)
  const raw = String(token || '').trim().toLowerCase()
  const index = Number.parseInt(raw, 10)
  if (Number.isFinite(index) && index >= 1 && index <= eventos.length) {
    return eventos[index - 1]
  }
  return eventos.find((ev) => ev.id.toLowerCase().startsWith(raw))
}

function targetToken(message, verbs) {
  const re = new RegExp(`\\b(?:${verbs})\\s+([a-f0-9-]{4,36}|\\d+)`, 'i')
  return String(message || '').match(re)?.[1]
}

export function isAgendaMessage(message) {
  const raw = String(message || '')
  const trimmed = raw.trim()
  if (/^[1-5]$/.test(trimmed)) return true
  if (/^aviso[1-5]$/i.test(trimmed)) return true
  if (/^aviso(0|5|10|15|30|60)$/i.test(trimmed)) return true
  if (AGENDA_KEYWORD_RE.test(raw)) return true
  return hasCreateIntent(raw) && Boolean(parseAgendaDateTime(raw))
}

export async function processarMensagemAgenda(usuario, phone, rawMessage) {
  const message = String(rawMessage || '').trim()
  if (!isAgendaMessage(message)) return null

  let reply = ''
  let intent = 'agenda_chat'
  let ok = true

  const uid = usuario?.dataUsuarioId ?? usuario?.id
  const familiaEscopo = usuario?.familiaEscopo || { isMembroConta: false }
  const bloqueioEscritaViewer = () => {
    const b = assertFamiliaPodeEscrever(familiaEscopo)
    return b ? `❌ ${b.message}` : null
  }

  try {
    const trimmedMsg = message.trim()
    const lower = trimmedMsg.toLowerCase()
    const ROW_TO_MINUTES = { aviso0: 0, aviso5: 5, aviso10: 10, aviso15: 15, aviso30: 30, aviso60: 60 }
    const DIGIT_TO_MINUTES = { '1': 0, '2': 5, '3': 10, '4': 30, '5': 60 }
    const menuMinutes =
      lower in ROW_TO_MINUTES
        ? ROW_TO_MINUTES[lower]
        : (() => {
            const d = trimmedMsg.match(/^([1-5])$/)?.[1] ?? trimmedMsg.match(/^aviso([1-5])$/i)?.[1]
            return d !== undefined ? DIGIT_TO_MINUTES[d] : undefined
          })()
    if (menuMinutes !== undefined) {
      const bloq = bloqueioEscritaViewer()
      if (bloq) return { ok: false, reply: bloq }
      intent = 'agenda_reminder_menu'
      const minutes = menuMinutes
      const recent = await ultimoEventoAgendaCriadoRecentemente(uid, 30)
      if (!recent) {
        reply =
          'Responda com *1* a *5* logo após criar o compromisso (ex.: marcar reunião amanhã 15h, depois envie *4* para 30 min antes).'
        return { ok: true, reply }
      }
      const updated = await atualizarAgendaEvento(recent.id, uid, {
        lembrar_minutos_antes: minutes,
        whatsapp_notificar: true,
      })
      reply = `⏰ Definido: aviso *${formatReminderLabel(minutes)}* antes de *${updated.titulo}*.\n🗓️ ${formatAgendaDateTime(updated.inicio, updated.timezone || AGENDA_TZ)}`
      return { ok: true, reply }
    }

    const text = stripAccents(message.toLowerCase())

    const createIntent = hasCreateIntent(message)
    const inicioParaCriar = parseAgendaDateTime(message)

    if (/\b(minha agenda|agenda hoje|compromissos hoje|hoje)\b/.test(text) && !createIntent) {
      intent = 'agenda_list_today'
      reply = formatLista(await listarProximos(uid, true), 'Agenda de hoje')
      return { ok: true, reply }
    }

    if (/\b(proximos|próximos|minha agenda|agenda|compromissos)\b/.test(message) && !createIntent) {
      intent = 'agenda_list'
      reply = formatLista(await listarProximos(uid, false), 'Próximos compromissos')
      return { ok: true, reply }
    }

    const cancelToken = targetToken(message, 'cancelar|desmarcar')
    if (cancelToken) {
      const bloq = bloqueioEscritaViewer()
      if (bloq) return { ok: false, reply: bloq }
      intent = 'agenda_cancel'
      const evento = await resolveEvento(uid, cancelToken)
      if (!evento) throw new Error('Não encontrei esse compromisso.')
      await atualizarAgendaStatus(evento.id, uid, 'CANCELADO')
      reply = `🗓️ Compromisso cancelado: *${evento.titulo}*.`
      return { ok: true, reply }
    }

    const confirmToken = targetToken(message, 'confirmar')
    if (confirmToken) {
      const bloq = bloqueioEscritaViewer()
      if (bloq) return { ok: false, reply: bloq }
      intent = 'agenda_confirm'
      const evento = await resolveEvento(uid, confirmToken)
      if (!evento) throw new Error('Não encontrei esse compromisso.')
      await atualizarAgendaStatus(evento.id, uid, 'CONFIRMADO')
      reply = `✅ Confirmado: *${evento.titulo}* em ${formatAgendaDateTime(evento.inicio, evento.timezone || AGENDA_TZ)}.`
      return { ok: true, reply }
    }

    const doneToken = targetToken(message, 'concluir|finalizar')
    if (doneToken) {
      const bloq = bloqueioEscritaViewer()
      if (bloq) return { ok: false, reply: bloq }
      intent = 'agenda_done'
      const evento = await resolveEvento(uid, doneToken)
      if (!evento) throw new Error('Não encontrei esse compromisso.')
      await atualizarAgendaStatus(evento.id, uid, 'CONCLUIDO')
      reply = `🏁 Concluído: *${evento.titulo}*.`
      return { ok: true, reply }
    }

    const rescheduleToken = targetToken(message, 'reagendar|remarcar')
    if (rescheduleToken) {
      const bloq = bloqueioEscritaViewer()
      if (bloq) return { ok: false, reply: bloq }
      intent = 'agenda_reschedule'
      const evento = await resolveEvento(uid, rescheduleToken)
      if (!evento) throw new Error('Não encontrei esse compromisso.')
      const inicio = parseAgendaDateTime(message)
      if (!inicio) throw new Error('Me diga a nova data e horário. Ex.: reagendar 1 para amanhã 10h.')
      const data = await atualizarAgendaEvento(evento.id, uid, { inicio: inicio.toISOString(), status: 'AGENDADO' })
      reply = `🔁 Reagendado: *${data.titulo}* para ${formatAgendaDateTime(data.inicio, data.timezone || AGENDA_TZ)}.`
      return { ok: true, reply }
    }

    if (createIntent) {
      const bloq = bloqueioEscritaViewer()
      if (bloq) return { ok: false, reply: bloq }
      intent = 'agenda_create'
      const inicio = inicioParaCriar
      if (!inicio) {
        reply = '🗓️ Para criar na agenda, envie algo como: *marcar reunião amanhã às 15h* ou *me lembra de pagar a luz sexta 9h*.'
        return { ok: true, reply }
      }
      const explicitReminder = parseReminderMinutes(message)
      const reminderCreate = isReminderCreateMessage(message)
      const data = await criarAgendaEvento(uid, {
        titulo: titleForCreate(message),
        descricao: reminderCreate ? 'Notificação criada pelo WhatsApp.' : undefined,
        inicio: inicio.toISOString(),
        lembrar_minutos_antes: explicitReminder !== null ? explicitReminder : 15,
        whatsapp_notificar: true,
      })

      if (explicitReminder !== null) {
        reply = `✅ ${reminderCreate ? 'Notificação criada!' : 'Compromisso criado!'}\n\n*${data.titulo}*\n${formatAgendaDateTime(data.inicio, data.timezone || AGENDA_TZ)}\n⏰ Aviso: ${formatReminderLabel(data.lembrar_minutos_antes)}`
        return { ok: true, reply }
      }

      const quando = formatAgendaDateTime(data.inicio, data.timezone || AGENDA_TZ)
      const label = reminderCreate ? 'Notificação criada!' : 'Compromisso criado!'
      return {
        ok: true,
        reply: `✅ ${label}\n*${data.titulo}*\n${quando}\n\nQuando quer ser avisado? Responda com:\n*1* – Na hora\n*2* – 5 min antes\n*3* – 10 min antes\n*4* – 30 min antes\n*5* – 1 hora antes`,
      }
    }

    const reminderMinutes = parseReminderMinutes(message)
    if (reminderMinutes !== null) {
      const bloq = bloqueioEscritaViewer()
      if (bloq) return { ok: false, reply: bloq }
      intent = 'agenda_reminder_config'
      const rawToken = targetToken(message, 'avise|avisar|lembre|lembrete')
      const token = rawToken === String(reminderMinutes) ? '1' : rawToken || '1'
      const evento = await resolveEvento(uid, token)
      if (!evento) throw new Error('Não encontrei compromisso para configurar o lembrete.')
      await atualizarAgendaEvento(evento.id, uid, {
        lembrar_minutos_antes: reminderMinutes,
        whatsapp_notificar: true,
      })
      reply = `⏰ Combinado. Vou avisar *${reminderMinutes} min antes* de ${evento.titulo}.`
      return { ok: true, reply }
    }

    reply = '🗓️ Posso ajudar com sua agenda. Ex.: *agenda hoje*, *marcar reunião amanhã 15h*, *me lembra de pagar a luz sexta 9h*, *confirmar 1*, *cancelar 1*.'
    return { ok: true, reply }
  } catch (error) {
    ok = false
    reply = `⚠️ ${error.message || 'Não consegui mexer na agenda agora.'}`
    return { ok: false, reply }
  } finally {
    await registrarInteracaoAgendaWhatsApp({
      usuarioId: usuario?.id,
      telefone: phone,
      mensagem: message,
      intencao: intent,
      resposta: reply,
      ok,
    })
  }
}

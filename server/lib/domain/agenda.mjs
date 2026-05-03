import { log } from '../logger.mjs'
import { getSupabaseAdmin } from '../supabase-admin.mjs'

export const AGENDA_TZ = 'America/Sao_Paulo'
export const AGENDA_STATUS = new Set(['AGENDADO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO'])

const STATUS_TO_DB = {
  AGENDADO: 'pendente',
  CONFIRMADO: 'confirmado',
  CONCLUIDO: 'concluido',
  CANCELADO: 'cancelado',
}

const STATUS_FROM_DB = {
  pendente: 'AGENDADO',
  agendado: 'AGENDADO',
  confirmado: 'CONFIRMADO',
  concluido: 'CONCLUIDO',
  cancelado: 'CANCELADO',
}

function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function parseReminderMinutes(value) {
  if (typeof value === 'string') {
    const text = value.toLowerCase()
    if (text.includes('sem')) return 0
    const n = Number.parseInt(text.match(/\d+/)?.[0] || '', 10)
    if (Number.isFinite(n)) return text.includes('hora') || text.includes('h') ? Math.min(n * 60, 1440) : Math.min(n, 1440)
  }
  const n = Number.parseInt(String(value ?? 15), 10)
  if (!Number.isFinite(n)) return 15
  return Math.min(Math.max(n, 0), 1440)
}

function reminderToDb(minutes, enabled = true) {
  const n = parseReminderMinutes(minutes)
  if (!enabled || n <= 0) return 'sem-lembrete'
  if (n % 60 === 0) return `${n / 60}h`
  return `${n}-min`
}

function parseDateOrThrow(value, label) {
  const d = new Date(value)
  if (!value || Number.isNaN(d.getTime())) throw new Error(`${label} inválido.`)
  return d
}

function normalizeStatus(status) {
  const value = String(status || '').trim().toUpperCase()
  if (!AGENDA_STATUS.has(value)) throw new Error('Status da agenda inválido.')
  return value
}

function statusFromDb(value) {
  return STATUS_FROM_DB[String(value || '').trim().toLowerCase()] || 'AGENDADO'
}

function defaultEndDate(inicioIso) {
  return new Date(new Date(inicioIso).getTime() + 60 * 60 * 1000).toISOString()
}

function toIso(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function normalizeEvento(row) {
  if (!row) return row
  const reminder = parseReminderMinutes(row.lembrete)
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    titulo: row.titulo || '',
    descricao: row.observacoes || row.descricao || '',
    local: row.local_texto || '',
    inicio: row.inicio_em,
    fim: row.fim_em,
    timezone: AGENDA_TZ,
    lembrar_minutos_antes: reminder || 0,
    whatsapp_notificar: reminder > 0,
    status: statusFromDb(row.situacao),
    origem: 'APP',
    confirmado_em: null,
    concluido_em: null,
    cancelado_em: null,
    created_at: row.criado_em,
    updated_at: row.atualizado_em,
  }
}

function buildEventoPayload(usuarioId, body, partial = false) {
  const payload = {}

  if (!partial || body.titulo !== undefined) {
    const titulo = cleanText(body.titulo, 160)
    if (titulo.length < 2) throw new Error('Informe um título para o compromisso.')
    payload.titulo = titulo
  }

  if (!partial || body.descricao !== undefined) payload.observacoes = cleanText(body.descricao, 1000)
  if (!partial || body.local !== undefined) payload.local_texto = cleanText(body.local, 180)

  if (!partial || body.inicio !== undefined) {
    const inicio = parseDateOrThrow(body.inicio, 'Data de início')
    payload.inicio_em = inicio.toISOString()
    if (!body.fim) payload.fim_em = defaultEndDate(payload.inicio_em)
  }

  if (body.fim !== undefined) {
    payload.fim_em = body.fim ? parseDateOrThrow(body.fim, 'Data de fim').toISOString() : defaultEndDate(payload.inicio_em || body.inicio)
  }

  if (!partial || body.lembrar_minutos_antes !== undefined || body.whatsapp_notificar !== undefined) {
    payload.lembrete = reminderToDb(body.lembrar_minutos_antes, body.whatsapp_notificar !== false)
  }

  if (body.status !== undefined) {
    payload.situacao = STATUS_TO_DB[normalizeStatus(body.status)]
  }

  if (!partial) {
    payload.usuario_id = String(usuarioId || '').trim()
    payload.tipo = 'compromisso'
    payload.categoria = 'Agenda'
    payload.subcategoria = ''
    payload.dia_inteiro = false
    payload.valor = null
    payload.prioridade = 'media'
    payload.recorrencia = 'nao-recorrente'
    payload.cor = '#8b5cf6'
    payload.situacao = payload.situacao || 'pendente'
  }

  payload.atualizado_em = new Date().toISOString()
  return payload
}

export function formatAgendaDateTime(iso, timeZone = AGENDA_TZ) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'data inválida'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatAgendaTime(iso, timeZone = AGENDA_TZ) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(d)
}

export async function listarAgendaEventos(usuarioId, filters = {}) {
  const supabase = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid) return []

  const now = new Date()
  const from = toIso(filters.from) || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const to = toIso(filters.to) || new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString()

  let q = supabase
    .from('agenda_eventos')
    .select('*')
    .eq('usuario_id', uid)
    .gte('inicio_em', from)
    .lte('inicio_em', to)
    .order('inicio_em', { ascending: true })

  if (filters.status) {
    q = q.eq('situacao', STATUS_TO_DB[normalizeStatus(filters.status)])
  } else if (filters.incluirCancelados !== true) {
    q = q.neq('situacao', 'cancelado')
  }

  const { data, error } = await q
  if (error) throw error
  return (data || []).map(normalizeEvento)
}

export async function criarAgendaEvento(usuarioId, body) {
  const supabase = getSupabaseAdmin()
  const payload = buildEventoPayload(usuarioId, body, false)
  const { data, error } = await supabase.from('agenda_eventos').insert(payload).select('*').maybeSingle()
  if (error) throw error
  return normalizeEvento(data)
}

export async function atualizarAgendaEvento(id, usuarioId, body) {
  const supabase = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  const payload = buildEventoPayload(uid, body, true)

  const { data, error } = await supabase
    .from('agenda_eventos')
    .update(payload)
    .eq('id', id)
    .eq('usuario_id', uid)
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Compromisso não encontrado.')
  return normalizeEvento(data)
}

export async function atualizarAgendaStatus(id, usuarioId, status) {
  const supabase = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  const nextStatus = normalizeStatus(status)
  const { data, error } = await supabase
    .from('agenda_eventos')
    .update({ situacao: STATUS_TO_DB[nextStatus], atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', uid)
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Compromisso não encontrado.')
  return normalizeEvento(data)
}

export async function deletarAgendaEvento(id, usuarioId) {
  const supabase = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  const { error } = await supabase.from('agenda_eventos').delete().eq('id', id).eq('usuario_id', uid)
  if (error) throw error
  return true
}

function buildReminderMessage(evento, offsetMinutos) {
  const quando = formatAgendaDateTime(evento.inicio, AGENDA_TZ)
  const local = evento.local ? `\n📍 ${evento.local}` : ''
  const desc = evento.descricao ? `\n📝 ${evento.descricao}` : ''
  const prefix = offsetMinutos > 0 ? `⏰ Lembrete: faltam ${offsetMinutos} min` : '⏰ Lembrete: está na hora'
  return `${prefix}\n\n*${evento.titulo}*\n🗓️ ${quando}${local}${desc}\n\nResponda: *confirmar ${evento.codigo}*, *concluir ${evento.codigo}* ou *reagendar ${evento.codigo} para amanhã 10h*.`
}

export async function listarEMarcarLembretesPendentes({ limit = 50, marcarComoEnviado = true } = {}) {
  const supabase = getSupabaseAdmin()
  const now = new Date()
  const from = new Date(now.getTime() - 15 * 60 * 1000).toISOString()
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const { data: rows, error } = await supabase
    .from('agenda_eventos')
    .select('*')
    .gte('inicio_em', from)
    .lte('inicio_em', to)
    .in('situacao', ['pendente', 'confirmado'])
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))

  if (error) throw error

  const due = []
  for (const row of rows || []) {
    const evento = normalizeEvento(row)
    const offset = evento.lembrar_minutos_antes || 0
    if (!evento.whatsapp_notificar || offset <= 0) continue
    const dueAt = new Date(new Date(evento.inicio).getTime() - offset * 60 * 1000)
    const lateLimit = new Date(now.getTime() - 15 * 60 * 1000)
    if (dueAt > now || dueAt < lateLimit) continue
    due.push(evento)
  }

  if (!due.length) return { ok: true, total: 0, mensagens: [] }

  const usuarioIds = [...new Set(due.map((ev) => ev.usuario_id).filter(Boolean))]
  const { data: usuarios, error: usersError } = await supabase
    .from('usuarios')
    .select('id, nome, telefone, whatsapp_id')
    .in('id', usuarioIds)
  if (usersError) throw usersError

  const reminderKeys = due.map((ev) => `agenda_reminder:${ev.id}:${ev.lembrar_minutos_antes}`)
  const { data: sentLogs } = await supabase
    .from('whatsapp_logs')
    .select('mensagem_recebida')
    .in('mensagem_recebida', reminderKeys)
    .eq('status', 'AGENDA_LEMBRETE_ENVIADO')
  const sent = new Set((sentLogs || []).map((logRow) => logRow.mensagem_recebida))
  const userMap = new Map((usuarios || []).map((u) => [u.id, u]))
  const mensagens = []

  for (const evento of due) {
    const key = `agenda_reminder:${evento.id}:${evento.lembrar_minutos_antes}`
    if (sent.has(key)) continue
    const usuario = userMap.get(evento.usuario_id)
    const phone = String(usuario?.whatsapp_id || usuario?.telefone || '').replace(/\D/g, '')
    if (!phone) {
      log.warn('[agenda] lembrete sem telefone', { eventoId: evento.id, usuarioId: evento.usuario_id })
      continue
    }
    const codigo = evento.id.slice(0, 8)
    mensagens.push({
      reminder_id: key,
      event_id: evento.id,
      user_id: evento.usuario_id,
      phone,
      title: evento.titulo,
      starts_at: evento.inicio,
      offset_minutes: evento.lembrar_minutos_antes,
      message: buildReminderMessage({ ...evento, codigo }, evento.lembrar_minutos_antes),
    })
  }

  if (marcarComoEnviado) await registrarLembretesAgendaEnviados(mensagens)

  return { ok: true, total: mensagens.length, mensagens }
}

export async function registrarLembretesAgendaEnviados(mensagens = []) {
  const items = Array.isArray(mensagens) ? mensagens : []
  if (!items.length) return { ok: true, total: 0 }

  const supabase = getSupabaseAdmin()
  const logs = items.map((m) => ({
    telefone_remetente: m.phone,
    mensagem_recebida: m.reminder_id,
    status: 'AGENDA_LEMBRETE_ENVIADO',
    detalhe_erro: null,
    usuario_id: m.user_id,
  }))
  const { error } = await supabase.from('whatsapp_logs').insert(logs)
  if (error) throw error
  return { ok: true, total: logs.length }
}

export async function registrarInteracaoAgendaWhatsApp({ usuarioId, telefone, mensagem, intencao, resposta, ok = true }) {
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from('whatsapp_logs').insert({
      usuario_id: usuarioId || null,
      telefone_remetente: cleanText(telefone, 40),
      mensagem_recebida: cleanText(`agenda:${intencao}:${mensagem}`, 1000),
      status: ok ? 'AGENDA_OK' : 'AGENDA_ERRO',
      detalhe_erro: cleanText(resposta, 1000),
    })
  } catch (error) {
    log.warn('[agenda] falha ao registrar interação WhatsApp', error)
  }
}

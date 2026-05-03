import { log } from '../logger.mjs'
import { getSupabaseAdmin } from '../supabase-admin.mjs'

export const AGENDA_STATUS = new Set(['AGENDADO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO'])
export const AGENDA_TZ = 'America/Sao_Paulo'

const DEFAULT_REMINDER_MINUTES = 15
const MAX_LIST_DAYS = 120

function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function parseReminderMinutes(value) {
  const n = Number.parseInt(String(value ?? DEFAULT_REMINDER_MINUTES), 10)
  if (!Number.isFinite(n)) return DEFAULT_REMINDER_MINUTES
  return Math.min(Math.max(n, 0), 1440)
}

function parseDateOrThrow(value, label) {
  const d = new Date(value)
  if (!value || Number.isNaN(d.getTime())) {
    throw new Error(`${label} inválido.`)
  }
  return d
}

function normalizeStatus(status) {
  const value = String(status || '').trim().toUpperCase()
  if (!AGENDA_STATUS.has(value)) throw new Error('Status da agenda inválido.')
  return value
}

function toIso(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function applyStatusTimestamps(payload, status) {
  const now = new Date().toISOString()
  if (status === 'CONFIRMADO') payload.confirmado_em = now
  if (status === 'CONCLUIDO') payload.concluido_em = now
  if (status === 'CANCELADO') payload.cancelado_em = now
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
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function buildEventoPayload(usuarioId, body, origem = 'APP', partial = false) {
  const payload = {}

  if (!partial || body.titulo !== undefined) {
    const titulo = cleanText(body.titulo, 160)
    if (titulo.length < 2) throw new Error('Informe um título para o compromisso.')
    payload.titulo = titulo
  }

  if (!partial || body.descricao !== undefined) payload.descricao = cleanText(body.descricao, 1000)
  if (!partial || body.local !== undefined) payload.local = cleanText(body.local, 180)

  if (!partial || body.inicio !== undefined) {
    const inicio = parseDateOrThrow(body.inicio, 'Data de início')
    payload.inicio = inicio.toISOString()
  }

  if (body.fim !== undefined) {
    payload.fim = body.fim ? parseDateOrThrow(body.fim, 'Data de fim').toISOString() : null
  }

  if (!partial || body.timezone !== undefined) {
    payload.timezone = cleanText(body.timezone || AGENDA_TZ, 80) || AGENDA_TZ
  }

  if (!partial || body.lembrar_minutos_antes !== undefined) {
    payload.lembrar_minutos_antes = parseReminderMinutes(body.lembrar_minutos_antes)
  }

  if (!partial || body.whatsapp_notificar !== undefined) {
    payload.whatsapp_notificar = body.whatsapp_notificar !== false
  }

  if (body.status !== undefined) {
    payload.status = normalizeStatus(body.status)
    applyStatusTimestamps(payload, payload.status)
  }

  if (!partial) {
    payload.usuario_id = String(usuarioId || '').trim()
    payload.origem = origem
    payload.status = payload.status || 'AGENDADO'
  }

  payload.updated_at = new Date().toISOString()
  return payload
}

async function sincronizarLembreteEvento(supabase, evento) {
  if (!evento?.id || !evento?.usuario_id) return

  await supabase.from('agenda_lembretes').delete().eq('evento_id', evento.id)

  if (!evento.whatsapp_notificar || evento.status === 'CANCELADO' || evento.status === 'CONCLUIDO') {
    return
  }

  const { error } = await supabase.from('agenda_lembretes').insert({
    evento_id: evento.id,
    usuario_id: evento.usuario_id,
    offset_minutos: parseReminderMinutes(evento.lembrar_minutos_antes),
    canal: 'WHATSAPP',
  })
  if (error) throw error
}

export async function listarAgendaEventos(usuarioId, filters = {}) {
  const supabase = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid) return []

  const now = new Date()
  const defaultTo = new Date(now.getTime() + MAX_LIST_DAYS * 24 * 60 * 60 * 1000)
  const from = toIso(filters.from) || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const to = toIso(filters.to) || defaultTo.toISOString()

  let q = supabase
    .from('agenda_eventos')
    .select(
      'id, usuario_id, titulo, descricao, local, inicio, fim, timezone, lembrar_minutos_antes, whatsapp_notificar, status, origem, confirmado_em, concluido_em, cancelado_em, created_at, updated_at'
    )
    .eq('usuario_id', uid)
    .gte('inicio', from)
    .lte('inicio', to)
    .order('inicio', { ascending: true })

  if (filters.status) {
    q = q.eq('status', normalizeStatus(filters.status))
  } else if (filters.incluirCancelados !== true) {
    q = q.neq('status', 'CANCELADO')
  }

  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function criarAgendaEvento(usuarioId, body, origem = 'APP') {
  const supabase = getSupabaseAdmin()
  const payload = buildEventoPayload(usuarioId, body, origem, false)

  const { data, error } = await supabase
    .from('agenda_eventos')
    .insert(payload)
    .select()
    .maybeSingle()

  if (error) throw error
  await sincronizarLembreteEvento(supabase, data)
  return data
}

export async function atualizarAgendaEvento(id, usuarioId, body) {
  const supabase = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  const payload = buildEventoPayload(uid, body, 'APP', true)

  const { data, error } = await supabase
    .from('agenda_eventos')
    .update(payload)
    .eq('id', id)
    .eq('usuario_id', uid)
    .select()
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Compromisso não encontrado.')
  await sincronizarLembreteEvento(supabase, data)
  return data
}

export async function atualizarAgendaStatus(id, usuarioId, status) {
  const supabase = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  const nextStatus = normalizeStatus(status)
  const payload = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }
  applyStatusTimestamps(payload, nextStatus)

  const { data, error } = await supabase
    .from('agenda_eventos')
    .update(payload)
    .eq('id', id)
    .eq('usuario_id', uid)
    .select()
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Compromisso não encontrado.')
  await sincronizarLembreteEvento(supabase, data)
  return data
}

export async function deletarAgendaEvento(id, usuarioId) {
  const supabase = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  const { error } = await supabase.from('agenda_eventos').delete().eq('id', id).eq('usuario_id', uid)
  if (error) throw error
  return true
}

function buildReminderMessage(evento, offsetMinutos) {
  const quando = formatAgendaDateTime(evento.inicio, evento.timezone || AGENDA_TZ)
  const local = evento.local ? `\n📍 ${evento.local}` : ''
  const desc = evento.descricao ? `\n📝 ${evento.descricao}` : ''
  const prefix = offsetMinutos > 0 ? `⏰ Lembrete: faltam ${offsetMinutos} min` : '⏰ Lembrete: está na hora'
  return `${prefix}\n\n*${evento.titulo}*\n🗓️ ${quando}${local}${desc}\n\nResponda: *confirmar ${evento.codigo}*, *concluir ${evento.codigo}* ou *reagendar ${evento.codigo} para amanhã 10h*.`
}

export async function listarEMarcarLembretesPendentes({ limit = 50, janelaMinutos = 5 } = {}) {
  const supabase = getSupabaseAdmin()
  const now = new Date()
  const maxWindow = new Date(now.getTime() + (1440 + janelaMinutos) * 60 * 1000).toISOString()

  const { data: lembretes, error } = await supabase
    .from('agenda_lembretes')
    .select(
      'id, evento_id, usuario_id, offset_minutos, canal, enviado_em, agenda_eventos!inner(id, usuario_id, titulo, descricao, local, inicio, fim, timezone, lembrar_minutos_antes, whatsapp_notificar, status)'
    )
    .is('enviado_em', null)
    .eq('canal', 'WHATSAPP')
    .lte('agenda_eventos.inicio', maxWindow)
    .in('agenda_eventos.status', ['AGENDADO', 'CONFIRMADO'])
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))

  if (error) throw error

  const due = []
  for (const lembrete of lembretes || []) {
    const evento = lembrete.agenda_eventos
    const dueAt = new Date(new Date(evento.inicio).getTime() - lembrete.offset_minutos * 60 * 1000)
    const lateLimit = new Date(now.getTime() - 15 * 60 * 1000)
    if (dueAt > now || dueAt < lateLimit) continue
    due.push({ lembrete, evento })
  }

  if (!due.length) return { ok: true, total: 0, mensagens: [] }

  const usuarioIds = [...new Set(due.map((item) => item.lembrete.usuario_id).filter(Boolean))]
  const { data: usuarios, error: usersError } = await supabase
    .from('usuarios')
    .select('id, nome, telefone, whatsapp_id')
    .in('id', usuarioIds)
  if (usersError) throw usersError

  const userMap = new Map((usuarios || []).map((u) => [u.id, u]))
  const nowIso = new Date().toISOString()
  const mensagens = []

  for (const item of due) {
    const { lembrete, evento } = item
    const usuario = userMap.get(lembrete.usuario_id)
    const phone = String(usuario?.whatsapp_id || usuario?.telefone || '').replace(/\D/g, '')
    if (!phone) {
      log.warn('[agenda] lembrete sem telefone', { eventoId: evento.id, usuarioId: lembrete.usuario_id })
      continue
    }

    const codigo = evento.id.slice(0, 8)
    const eventoComCodigo = { ...evento, codigo }
    mensagens.push({
      reminder_id: lembrete.id,
      event_id: evento.id,
      user_id: lembrete.usuario_id,
      phone,
      title: evento.titulo,
      starts_at: evento.inicio,
      offset_minutes: lembrete.offset_minutos,
      message: buildReminderMessage(eventoComCodigo, lembrete.offset_minutos),
    })
  }

  if (mensagens.length) {
    const ids = mensagens.map((m) => m.reminder_id)
    const { error: upErr } = await supabase
      .from('agenda_lembretes')
      .update({ enviado_em: nowIso, updated_at: nowIso })
      .in('id', ids)
    if (upErr) throw upErr
  }

  return { ok: true, total: mensagens.length, mensagens }
}

export async function registrarInteracaoAgendaWhatsApp({ usuarioId, telefone, mensagem, intencao, resposta, ok = true }) {
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from('agenda_interacoes_whatsapp').insert({
      usuario_id: usuarioId || null,
      telefone: cleanText(telefone, 40),
      mensagem: cleanText(mensagem, 1000),
      intencao: cleanText(intencao, 80),
      resposta: cleanText(resposta, 2000),
      ok,
    })
  } catch (error) {
    log.warn('[agenda] falha ao registrar interação WhatsApp', error)
  }
}

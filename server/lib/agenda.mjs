import { getSupabaseAdmin } from './supabase-admin.mjs'
import { isUuidString } from './transacao-validate.mjs'

/** @param {Record<string, unknown>} row */
export function mapRowToEvent(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.titulo ?? '',
    description: row.descricao ?? '',
    type: row.tipo ?? 'compromisso',
    category: row.categoria ?? '',
    subcategory: row.subcategoria ?? '',
    startAt: row.inicio_em ? new Date(row.inicio_em).toISOString() : '',
    endAt: row.fim_em ? new Date(row.fim_em).toISOString() : '',
    allDay: Boolean(row.dia_inteiro),
    location: row.local_texto ?? '',
    notes: row.observacoes ?? '',
    amount: row.valor != null && row.valor !== '' ? Number(row.valor) : null,
    status: row.situacao ?? 'pendente',
    priority: row.prioridade ?? 'media',
    recurrence: row.recorrencia ?? 'nao-recorrente',
    reminder: row.lembrete ?? '30-min',
    color: row.cor ?? '#64748b',
    linkedTransactionId: row.transacao_vinculada_id ?? null,
    createdAt: row.criado_em ? new Date(row.criado_em).toISOString() : undefined,
    updatedAt: row.atualizado_em ? new Date(row.atualizado_em).toISOString() : undefined,
  }
}

function mergeDefined(base, partial) {
  const out = { ...base }
  for (const k of Object.keys(partial)) {
    if (partial[k] !== undefined) out[k] = partial[k]
  }
  return out
}

/** @param {Record<string, unknown>} body */
function payloadToRow(body) {
  const linked = body.linkedTransactionId
  const linkedId =
    linked === null || linked === undefined || linked === ''
      ? null
      : isUuidString(String(linked))
        ? String(linked)
        : null

  let amount = null
  if (body.amount !== null && body.amount !== undefined && body.amount !== '') {
    const n = Number(body.amount)
    amount = Number.isFinite(n) ? n : null
  }

  return {
    titulo: String(body.title ?? '').trim(),
    descricao: String(body.description ?? ''),
    tipo: String(body.type ?? 'compromisso'),
    categoria: String(body.category ?? ''),
    subcategoria: String(body.subcategory ?? ''),
    inicio_em: body.startAt,
    fim_em: body.endAt,
    dia_inteiro: Boolean(body.allDay),
    local_texto: String(body.location ?? ''),
    observacoes: String(body.notes ?? ''),
    valor: amount,
    situacao: String(body.status ?? 'pendente'),
    prioridade: String(body.priority ?? 'media'),
    recorrencia: String(body.recurrence ?? 'nao-recorrente'),
    lembrete: String(body.reminder ?? '30-min'),
    cor: String(body.color ?? '#64748b'),
    transacao_vinculada_id: linkedId,
  }
}

function assertValidDates(inicio, fim) {
  const a = new Date(inicio)
  const b = new Date(fim)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    throw new Error('Datas inválidas.')
  }
  if (b < a) throw new Error('O fim deve ser após o início.')
}

/**
 * @param {string} usuarioId
 * @param {Record<string, unknown>} body
 * @param {{ partial?: boolean }} [opts]
 */
export function validateAgendaBody(body, opts = {}) {
  const partial = opts.partial === true
  if (!partial && !String(body.title ?? '').trim()) {
    return { ok: false, message: 'Informe o título.' }
  }
  if (!partial) {
    if (!body.startAt || !body.endAt) {
      return { ok: false, message: 'Informe início e fim.' }
    }
    try {
      assertValidDates(body.startAt, body.endAt)
    } catch (e) {
      return { ok: false, message: e?.message || 'Datas inválidas.' }
    }
  }
  return { ok: true }
}

export async function listAgendaEventos(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid) return []

  const { data, error } = await supabaseAdmin
    .from('agenda_eventos')
    .select('*')
    .eq('usuario_id', uid)
    .order('inicio_em', { ascending: false })

  if (error) throw error
  return (data || []).map((r) => mapRowToEvent(r))
}

export async function getAgendaEventoById(usuarioId, id) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid || !isUuidString(id)) return null

  const { data, error } = await supabaseAdmin
    .from('agenda_eventos')
    .select('*')
    .eq('id', id)
    .eq('usuario_id', uid)
    .maybeSingle()

  if (error) throw error
  return data ? mapRowToEvent(data) : null
}

export async function insertAgendaEvento(usuarioId, body) {
  const v = validateAgendaBody(body, { partial: false })
  if (!v.ok) throw new Error(v.message)

  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid) throw new Error('Usuário inválido.')

  const row = payloadToRow(body)
  assertValidDates(row.inicio_em, row.fim_em)

  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('agenda_eventos')
    .insert({
      usuario_id: uid,
      ...row,
      criado_em: now,
      atualizado_em: now,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapRowToEvent(data)
}

export async function atualizarAgendaEvento(usuarioId, id, partial) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid || !isUuidString(id)) throw new Error('ID inválido.')

  const { data: existingRow, error: errLoad } = await supabaseAdmin
    .from('agenda_eventos')
    .select('*')
    .eq('id', id)
    .eq('usuario_id', uid)
    .maybeSingle()

  if (errLoad) throw errLoad
  if (!existingRow) throw new Error('Evento não encontrado.')

  const base = mapRowToEvent(existingRow)
  const merged = mergeDefined(base, partial)

  const v = validateAgendaBody(merged, { partial: false })
  if (!v.ok) throw new Error(v.message)

  const row = payloadToRow(merged)
  assertValidDates(row.inicio_em, row.fim_em)

  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('agenda_eventos')
    .update({
      ...row,
      atualizado_em: now,
    })
    .eq('id', id)
    .eq('usuario_id', uid)
    .select('*')
    .single()

  if (error) throw error
  return mapRowToEvent(data)
}

export async function deletarAgendaEvento(usuarioId, id) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid || !isUuidString(id)) throw new Error('ID inválido.')

  const { error } = await supabaseAdmin.from('agenda_eventos').delete().eq('id', id).eq('usuario_id', uid)

  if (error) throw error
  return true
}

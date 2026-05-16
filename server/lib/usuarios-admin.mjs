import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import {
  aggregatePagamentosFinanceirosPorUsuarioIds,
  agregarPagamentosAprovadosGlobais,
  fetchUsuarioIdsComPagamentoAprovado,
  resumoPagamentosPorUsuarioIds,
} from './pagamentos-asaas.mjs'
import { normalizeUsuarioRow, stripSenha } from './usuario-schema.mjs'
import { isSuperAdminEmail, superAdminEmail } from './super-admin.mjs'
import { insertAdminAuditLog } from './admin-audit.mjs'
import { actorCanAssignAdminRole, normalizeRoleKey } from './admin-role-policy.mjs'

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export function toAdminUsuarioDto(rawRow, latestByUser, approvedIds, financeMap) {
  const n = normalizeUsuarioRow(stripSenha(rawRow))
  const id = n.id
  const idStr = id ? String(id) : ''
  const latest = id ? latestByUser.get(id) : null
  const agg = idStr && financeMap ? financeMap.get(idStr) : null
  const paid = id ? approvedIds.has(id) || approvedIds.has(idStr) : false
  const exempt = n.isento_pagamento === true
  const trialMs = n.trial_ends_at ? new Date(n.trial_ends_at).getTime() : null
  const now = Date.now()
  let paymentStatus = 'desconhecido'
  if (exempt) paymentStatus = 'isento'
  else if (paid) paymentStatus = 'pago'
  else if (trialMs != null && !Number.isNaN(trialMs) && trialMs > now) paymentStatus = 'trial_ativo'
  else if (trialMs != null && !Number.isNaN(trialMs) && trialMs <= now) paymentStatus = 'inadimplente'
  else paymentStatus = 'sem_trial'

  let isOverdue = false
  if (!exempt && !paid && n.is_active !== false && trialMs != null && !Number.isNaN(trialMs) && trialMs < now) {
    isOverdue = true
  }

  let daysToExpire = null
  if (trialMs != null && !Number.isNaN(trialMs) && trialMs > now) {
    daysToExpire = Math.ceil((trialMs - now) / 86400000)
  }
  const nextPayIso = n.assinatura_proxima_cobranca
  if (nextPayIso) {
    const np = new Date(nextPayIso).getTime()
    if (!Number.isNaN(np) && np > now) {
      const d = Math.ceil((np - now) / 86400000)
      if (daysToExpire == null || d < daysToExpire) daysToExpire = d
    }
  }

  return {
    ...n,
    nome: n.nome ?? '',
    role: n.role ?? 'USER',
    is_active: n.is_active !== false,
    last_login_at: n.last_login_at ?? null,
    created_at: n.created_at ?? null,
    isento_pagamento: n.isento_pagamento === true,
    trial_ends_at: n.trial_ends_at ?? null,
    bem_vindo_pagamento_visto_at: n.bem_vindo_pagamento_visto_at ?? null,
    pagamento_aprovado: paid,
    pagamento_ultimo_status: latest?.status ?? null,
    pagamento_ultimo_amount: latest?.amount ?? null,
    pagamento_ultimo_em: latest?.updated_at ?? latest?.created_at ?? null,
    pagamento_ultimo_detalhe: latest?.status_detail ?? null,
    accumulatedRevenue: agg?.accumulatedRevenue ?? 0,
    monthlyRevenue: agg?.monthlyRevenue ?? 0,
    lastPaymentDate: agg?.lastPaymentDate ?? null,
    nextPaymentDate: n.assinatura_proxima_cobranca ?? null,
    dueDate: n.trial_ends_at ?? null,
    subscriptionStatus: n.assinatura_asaas_status ?? null,
    billingCycle: null,
    planName: null,
    paymentStatus,
    isOverdue,
    daysToExpire,
    notes: null,
  }
}

// ---------------------------------------------------------------------------
// Helpers de query PostgREST
// ---------------------------------------------------------------------------

function escapeIlike(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * PostgREST: em `.or()`, valores com caracteres reservados (`:`, `.`, `,`, etc.) precisam de aspas.
 * Timestamps ISO sem aspas quebram o parser e geram 400/PGRST100 — ex.: stats da lista admin.
 * @see https://docs.postgrest.org/en/stable/references/api/tables_views.html
 */
function postgrestOrFilterQuotedValue(v) {
  const s = String(v ?? '')
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Vírgulas quebram o filtro `.or()` do PostgREST (o separador entre condições é `,`). */
function sanitizeOrSearchText(s) {
  return String(s || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

async function fetchUsuariosAdminStats(supabaseAdmin) {
  const nowIso = new Date().toISOString()
  const [t, a, adm, trial] = await Promise.all([
    supabaseAdmin.from('usuarios').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('usuarios').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('usuarios').select('id', { count: 'exact', head: true }).eq('role', 'ADMIN'),
    supabaseAdmin.from('usuarios').select('id', { count: 'exact', head: true }).gt('trial_ends_at', nowIso),
  ])
  return {
    total: t.count ?? 0,
    ativos: a.count ?? 0,
    admins: adm.count ?? 0,
    trial_ativos: trial.count ?? 0,
  }
}

async function fetchUsuariosAdminStatsExtended(supabaseAdmin) {
  const nowIso = new Date().toISOString()
  const staleCut = new Date(Date.now() - 30 * 86400000).toISOString()

  // Isolado fora do Promise.all: falha de pagamentos não deve bloquear a lista de usuários
  let fin = { paidUserIds: new Set(), accumulatedRevenue: 0, monthlyRevenue: 0 }
  try {
    const rawFin = await agregarPagamentosAprovadosGlobais()
    fin = rawFin || fin
  } catch (e) {
    log.warn('[admin stats] agregarPagamentosAprovadosGlobais falhou, usando zeros:', e?.message ?? e)
  }

  const [base, np, nt, stale, overdueTrial] = await Promise.all([
    fetchUsuariosAdminStats(supabaseAdmin),
    supabaseAdmin
      .from('usuarios')
      .select('assinatura_proxima_cobranca')
      .gt('assinatura_proxima_cobranca', nowIso)
      .order('assinatura_proxima_cobranca', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('usuarios')
      .select('trial_ends_at')
      .gt('trial_ends_at', nowIso)
      .order('trial_ends_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .or(`last_login_at.is.null,last_login_at.lt.${postgrestOrFilterQuotedValue(staleCut)}`),
    supabaseAdmin
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .lt('trial_ends_at', nowIso)
      .eq('isento_pagamento', false)
      .eq('is_active', true),
  ])

  const proxPag = np.data?.assinatura_proxima_cobranca ?? null
  const proxTrial = nt.data?.trial_ends_at ?? null
  let proximoVencimento = null
  const tPag = proxPag ? new Date(proxPag).getTime() : NaN
  const tTr = proxTrial ? new Date(proxTrial).getTime() : NaN
  if (!Number.isNaN(tPag) && !Number.isNaN(tTr)) {
    proximoVencimento = tPag < tTr ? proxPag : proxTrial
  } else if (!Number.isNaN(tPag)) proximoVencimento = proxPag
  else if (!Number.isNaN(tTr)) proximoVencimento = proxTrial

  const numPagos = fin.paidUserIds?.size ?? 0
  const ticketMedio = numPagos > 0 ? fin.accumulatedRevenue / numPagos : 0

  return {
    ...base,
    assinaturas_pagas: numPagos,
    ganho_acumulado_total: fin.accumulatedRevenue,
    receita_mensal_total: fin.monthlyRevenue,
    ticket_medio_usuario: ticketMedio,
    proximo_pagamento: proxPag,
    proximo_vencimento: proximoVencimento,
    contas_sem_login_recente: stale.count ?? 0,
    trials_vencidos_conta: overdueTrial.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Filtros e sort
// ---------------------------------------------------------------------------

function applyUsuariosAdminFilters(supabaseAdmin, query, approvedUserSet) {
  const nowIso = new Date().toISOString()
  const staleCut = new Date(Date.now() - 30 * 86400000).toISOString()
  const q = String(query.q || '').trim()
  const role = String(query.role || '').trim().toUpperCase()
  const conta = String(query.conta || '').trim()
  const assinatura = String(query.assinatura || '').trim().toLowerCase()
  const login = String(query.login || '').trim().toLowerCase()
  const createdFrom = String(query.createdFrom || '').trim()
  const createdTo = String(query.createdTo || '').trim()
  const accessFrom = String(query.accessFrom || '').trim()
  const accessTo = String(query.accessTo || '').trim()
  const payFrom = String(query.payFrom || '').trim()
  const payTo = String(query.payTo || '').trim()
  const trialEndsFrom = String(query.trialEndsFrom || '').trim()
  const trialEndsTo = String(query.trialEndsTo || '').trim()

  let qb = supabaseAdmin.from('usuarios').select()

  if (q) {
    const qTrim = sanitizeOrSearchText(q)
    if (qTrim && UUID_RE.test(qTrim)) {
      qb = qb.eq('id', qTrim.toLowerCase())
    } else if (qTrim) {
      const term = `%${escapeIlike(qTrim)}%`
      qb = qb.or(`nome.ilike.${term},email.ilike.${term},telefone.ilike.${term}`)
    }
  }
  if (role && ['USER', 'ADMIN', 'READONLY'].includes(role)) {
    qb = qb.eq('role', role)
  }
  if (conta === 'ativo') qb = qb.eq('is_active', true)
  if (conta === 'inativo') qb = qb.eq('is_active', false)

  if (createdFrom) {
    qb = qb.gte('created_at', createdFrom.includes('T') ? createdFrom : `${createdFrom}T00:00:00.000Z`)
  }
  if (createdTo) {
    qb = qb.lte('created_at', createdTo.includes('T') ? createdTo : `${createdTo}T23:59:59.999Z`)
  }
  if (accessFrom) {
    qb = qb.gte('last_login_at', accessFrom.includes('T') ? accessFrom : `${accessFrom}T00:00:00.000Z`)
  }
  if (accessTo) {
    qb = qb.lte('last_login_at', accessTo.includes('T') ? accessTo : `${accessTo}T23:59:59.999Z`)
  }
  if (payFrom) {
    qb = qb.gte('assinatura_proxima_cobranca', payFrom.includes('T') ? payFrom : `${payFrom}T00:00:00.000Z`)
  }
  if (payTo) {
    qb = qb.lte('assinatura_proxima_cobranca', payTo.includes('T') ? payTo : `${payTo}T23:59:59.999Z`)
  }
  if (trialEndsFrom) {
    qb = qb.gte('trial_ends_at', trialEndsFrom.includes('T') ? trialEndsFrom : `${trialEndsFrom}T00:00:00.000Z`)
  }
  if (trialEndsTo) {
    qb = qb.lte('trial_ends_at', trialEndsTo.includes('T') ? trialEndsTo : `${trialEndsTo}T23:59:59.999Z`)
  }

  if (login === 'nunca') qb = qb.is('last_login_at', null)
  if (login === 'stale') {
    qb = qb.or(`last_login_at.is.null,last_login_at.lt.${postgrestOrFilterQuotedValue(staleCut)}`)
  }

  if (assinatura === 'isento') qb = qb.eq('isento_pagamento', true)
  if (assinatura === 'trial') qb = qb.gt('trial_ends_at', nowIso)
  if (assinatura === 'pago') {
    const arr = approvedUserSet && approvedUserSet.size ? [...approvedUserSet] : []
    if (arr.length) qb = qb.in('id', arr)
    else qb = qb.eq('id', '00000000-0000-0000-0000-000000000000')
  }
  if (assinatura === 'nao_pago') {
    const arr = approvedUserSet && approvedUserSet.size ? [...approvedUserSet] : []
    if (arr.length) {
      const chunk = 120
      for (let i = 0; i < arr.length; i += chunk) {
        const part = arr.slice(i, i + chunk)
        qb = qb.not('id', 'in', `(${part.join(',')})`)
      }
    }
  }
  if (assinatura === 'inadimplente') {
    qb = qb.lt('trial_ends_at', nowIso).eq('isento_pagamento', false).eq('is_active', true)
    const arr = approvedUserSet && approvedUserSet.size ? [...approvedUserSet] : []
    if (arr.length) {
      const chunk = 120
      for (let i = 0; i < arr.length; i += chunk) {
        const part = arr.slice(i, i + chunk)
        qb = qb.not('id', 'in', `(${part.join(',')})`)
      }
    }
  }

  return qb
}

async function fetchAllUsuarioIdsForAdminList(supabaseAdmin, query, approvedUserSet) {
  let qbCount = applyUsuariosAdminFilters(supabaseAdmin, query, approvedUserSet)
  const counted = await qbCount.select('id', { count: 'exact', head: true })
  if (counted.error) throw counted.error
  const total = counted.count ?? 0

  const allIds = []
  let from = 0
  const chunk = 1000
  let guard = 0
  while (guard < 100) {
    let qb = applyUsuariosAdminFilters(supabaseAdmin, query, approvedUserSet)
    qb = qb.select('id')
    qb = applyUsuariosAdminSort(qb, 'email_asc')
    const res = await qb.range(from, from + chunk - 1)
    if (res.error) throw res.error
    const rows = res.data || []
    for (const r of rows) {
      if (r.id) allIds.push(r.id)
    }
    if (rows.length < chunk) break
    from += chunk
    guard += 1
  }
  return { allIds, total }
}

function applyUsuariosAdminSort(qb, sort) {
  if (!qb || typeof qb.order !== 'function') {
    log.error('[applyUsuariosAdminSort] qb inválido:', typeof qb, qb?.constructor?.name, Object.keys(qb || {}))
    return qb
  }
  const s = String(sort || 'email_asc').toLowerCase()
  switch (s) {
    case 'email_desc':
      return qb.order('email', { ascending: false })
    case 'nome_asc':
      return qb.order('nome', { ascending: true, nullsFirst: false })
    case 'nome_desc':
      return qb.order('nome', { ascending: false, nullsFirst: false })
    case 'last_login_desc':
      return qb.order('last_login_at', { ascending: false, nullsFirst: false })
    case 'last_login_asc':
      return qb.order('last_login_at', { ascending: true, nullsFirst: false })
    case 'trial_asc':
      return qb.order('trial_ends_at', { ascending: true, nullsFirst: false })
    case 'trial_desc':
      return qb.order('trial_ends_at', { ascending: false, nullsFirst: false })
    case 'next_pay_asc':
      return qb.order('assinatura_proxima_cobranca', { ascending: true, nullsFirst: false })
    case 'next_pay_desc':
      return qb.order('assinatura_proxima_cobranca', { ascending: false, nullsFirst: false })
    case 'created_desc':
      return qb.order('created_at', { ascending: false, nullsFirst: false })
    case 'created_asc':
      return qb.order('created_at', { ascending: true, nullsFirst: false })
    case 'email_asc':
    default:
      return qb.order('email', { ascending: true })
  }
}

// ---------------------------------------------------------------------------
// Exports públicos
// ---------------------------------------------------------------------------

/**
 * Lista paginada + filtros + totais globais (KPIs).
 * @param {Record<string, string | number | undefined>} query
 */
export async function listUsuariosAdminPaged(query) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1)
    const pageSize = Math.min(5000, Math.max(1, parseInt(String(query.pageSize || '12'), 10) || 12))
    const offset = (page - 1) * pageSize
    const sort = String(query.sort || 'email_asc').trim().toLowerCase()

    let approvedUserSet = null
    const assinatura = String(query.assinatura || '').trim().toLowerCase()
    if (['pago', 'nao_pago', 'inadimplente'].includes(assinatura)) {
      approvedUserSet = await fetchUsuarioIdsComPagamentoAprovado()
    }

    const stats = await fetchUsuariosAdminStatsExtended(supabaseAdmin)

    if (sort === 'revenue_desc' || sort === 'revenue_asc') {
      const { allIds, total } = await fetchAllUsuarioIdsForAdminList(supabaseAdmin, query, approvedUserSet)
      const finMap = await aggregatePagamentosFinanceirosPorUsuarioIds(allIds)
      const asc = sort === 'revenue_asc'
      const sortedIds = [...allIds].sort((a, b) => {
        const va = finMap.get(String(a))?.accumulatedRevenue ?? 0
        const vb = finMap.get(String(b))?.accumulatedRevenue ?? 0
        if (va === vb) return String(a).localeCompare(String(b))
        return asc ? va - vb : vb - va
      })
      const pageIds = sortedIds.slice(offset, offset + pageSize)
      if (!pageIds.length) {
        return { items: [], total, page, pageSize, stats }
      }
      const resRows = await supabaseAdmin.from('usuarios').select('*').in('id', pageIds)
      if (resRows.error) throw resRows.error
      const byId = new Map((resRows.data || []).map((r) => [r.id, r]))
      const rawRows = pageIds.map((id) => byId.get(id)).filter(Boolean)
      const ids = rawRows.map((r) => r.id).filter(Boolean)
      const { latestByUser, approvedIds } = await resumoPagamentosPorUsuarioIds(ids)
      const financeMap = await aggregatePagamentosFinanceirosPorUsuarioIds(ids)
      const items = rawRows.map((row) => toAdminUsuarioDto(row, latestByUser, approvedIds, financeMap))
      return { items, total, page, pageSize, stats }
    }

    let qb = applyUsuariosAdminFilters(supabaseAdmin, query, approvedUserSet)
    qb = qb.select('*', { count: 'exact' })
    qb = applyUsuariosAdminSort(qb, sort)
    const res = await qb.range(offset, offset + pageSize - 1)
    if (res.error) throw res.error

    const rawRows = res.data || []
    const total = typeof res.count === 'number' ? res.count : rawRows.length
    const ids = rawRows.map((r) => r.id).filter(Boolean)
    const { latestByUser, approvedIds } = await resumoPagamentosPorUsuarioIds(ids)
    const financeMap = await aggregatePagamentosFinanceirosPorUsuarioIds(ids)
    const items = rawRows.map((row) => toAdminUsuarioDto(row, latestByUser, approvedIds, financeMap))

    return { items, total, page, pageSize, stats }
  } catch (err) {
    log.error('[listUsuariosAdminPaged] erro fatal:', err)
    throw err
  }
}

export async function updateUsuarioAdmin(id, payload, ctx = {}) {
  const { actorUserId, clientIp } = ctx
  const supabaseAdmin = getSupabaseAdmin()

  // Query direta para evitar dependência circular com usuarios.mjs
  let actorEmail = null
  if (actorUserId) {
    const { data: actorRow } = await supabaseAdmin
      .from('usuarios')
      .select('email')
      .eq('id', actorUserId)
      .maybeSingle()
    actorEmail = actorRow?.email ?? null
  }

  const { data: beforeRow, error: fetchErr } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !beforeRow) {
    throw fetchErr || Object.assign(new Error('Usuário não encontrado.'), { statusCode: 404 })
  }
  const targetEmail = String(beforeRow.email || '').trim().toLowerCase()

  if (payload.email !== undefined) {
    const newEmail = String(payload.email).trim().toLowerCase()
    if (targetEmail === superAdminEmail() && newEmail !== superAdminEmail()) {
      const e = new Error('O e-mail da conta administradora principal não pode ser alterado.')
      e.statusCode = 403
      throw e
    }
  }
  if (payload.role !== undefined) {
    const prevRole = normalizeRoleKey(beforeRow.role)
    const newRole = normalizeRoleKey(payload.role)
    if (newRole === 'ADMIN' && !actorCanAssignAdminRole(actorEmail)) {
      const e = new Error('Apenas o administrador principal pode atribuir o papel Admin.')
      e.statusCode = 403
      throw e
    }
    if (prevRole === 'ADMIN' && newRole !== 'ADMIN' && !actorCanAssignAdminRole(actorEmail)) {
      const e = new Error('Apenas o administrador principal pode rebaixar outro administrador.')
      e.statusCode = 403
      throw e
    }
    if (targetEmail === superAdminEmail() && newRole !== 'ADMIN') {
      const e = new Error('A role da conta administradora principal deve permanecer ADMIN.')
      e.statusCode = 403
      throw e
    }
    payload = { ...payload, role: newRole }
  }

  const patch = {}
  if (payload.nome !== undefined) patch.nome = payload.nome
  if (payload.email !== undefined) patch.email = payload.email
  if (payload.telefone !== undefined) {
    patch.telefone = String(payload.telefone).replace(/\D/g, '')
  }
  if (payload.role !== undefined) patch.role = payload.role
  if (payload.is_active !== undefined) patch.is_active = payload.is_active
  if (payload.isento_pagamento !== undefined) patch.isento_pagamento = !!payload.isento_pagamento

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  const mp = await resumoPagamentosPorUsuarioIds([data.id])
  const fin = await aggregatePagamentosFinanceirosPorUsuarioIds([data.id])
  const dto = toAdminUsuarioDto(data, mp.latestByUser, mp.approvedIds, fin)

  await insertAdminAuditLog({
    actorUserId: actorUserId || null,
    action: 'usuario_atualizado',
    targetUserId: id,
    targetEmail: beforeRow.email,
    clientIp: clientIp || null,
    detail: {
      antes: {
        nome: beforeRow.nome,
        email: beforeRow.email,
        role: beforeRow.role,
        is_active: beforeRow.is_active,
        isento_pagamento: beforeRow.isento_pagamento,
      },
      depois: {
        nome: data.nome,
        email: data.email,
        role: data.role,
        is_active: data.is_active,
        isento_pagamento: data.isento_pagamento,
      },
    },
  })

  return dto
}

export async function deleteUsuarioAdmin(id, ctx = {}) {
  const { actorUserId, clientIp } = ctx
  const supabaseAdmin = getSupabaseAdmin()
  const { data: t } = await supabaseAdmin.from('usuarios').select('id, email').eq('id', id).single()
  if (t?.email && isSuperAdminEmail(t.email)) {
    const e = new Error('Não é possível excluir a conta administradora principal.')
    e.statusCode = 403
    throw e
  }
  const { error } = await supabaseAdmin.from('usuarios').delete().eq('id', id)
  if (error) throw error

  await insertAdminAuditLog({
    actorUserId: actorUserId || null,
    action: 'usuario_excluido',
    targetUserId: id,
    targetEmail: t?.email || null,
    clientIp: clientIp || null,
  })
}

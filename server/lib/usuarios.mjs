import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import {
  aggregatePagamentosFinanceirosPorUsuarioIds,
  agregarPagamentosAprovadosGlobais,
  fetchUsuarioIdsComPagamentoAprovado,
  resumoPagamentosPorUsuarioIds,
} from './pagamentos-mp.mjs'
import { resolverUsuarioIdPorTelefoneGemini } from './ai.mjs'
import { normalizeUsuarioRow, stripSenha } from './usuario-schema.mjs'
import { isSuperAdminEmail, superAdminEmail } from './super-admin.mjs'
import { insertAdminAuditLog } from './admin-audit.mjs'
import { actorCanAssignAdminRole, normalizeRoleKey } from './admin-role-policy.mjs'

export async function atualizarTelefoneUsuario(usuarioId, telefoneLimpo) {
  const supabaseAdmin = getSupabaseAdmin()

  const clean = String(telefoneLimpo || '').replace(/\D/g, '')

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update({ telefone: clean })
    .eq('id', usuarioId)
    .select('id, telefone')
    .single()

  if (error) {
    if (error.code === '23505') { // unique violation
      throw new Error('Este telefone já está cadastrado em outra conta.')
    }
    throw error
  }

  return data
}

export async function atualizarWhatsappId(usuarioId, whatsappId) {
  const supabaseAdmin = getSupabaseAdmin()
  const digits = String(whatsappId || '').replace(/\D/g, '')
  if (!digits) return
  const { error } = await supabaseAdmin
    .from('usuarios')
    .update({ whatsapp_id: digits })
    .eq('id', usuarioId)
    .is('whatsapp_id', null)
  if (error) log.warn('[atualizarWhatsappId] Erro:', error.message)
}

export async function vincularWhatsappId(usuarioId, whatsappId) {
  const supabaseAdmin = getSupabaseAdmin()
  const digits = String(whatsappId || '').replace(/\D/g, '')
  if (!digits) throw new Error('whatsapp_id vazio')
  const { error } = await supabaseAdmin
    .from('usuarios')
    .update({ whatsapp_id: digits })
    .eq('id', usuarioId)
  if (error) throw error
}

/**
 * Celular BR completo: 55 + DDD(2) + 9 dígitos = 13 caracteres.
 * Nunca aplicar slice(0,11) nesse formato — virava 55549969944 e sumia dígito (ex.: 54996994482).
 */
export function normalizarDigitosWhatsappLog(digitos) {
  const d = String(digitos || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('55') && d.length === 13) return d
  if (!d.startsWith('55') && d.length === 11 && /^\d{2}9\d{8}$/.test(d)) return `55${d}`
  if (d.startsWith('55') && d.length > 13) return d.slice(0, 13)
  return d
}

/**
 * Gera variantes com/sem DDI 55 para bater com o cadastro (ex.: 11999... vs 5511999...).
 * LID longo: truncar só quando não for E.164 BR 13 dígitos.
 */
export function variantesTelefoneBrasil(digitos) {
  const d = String(digitos || '').replace(/\D/g, '')
  if (!d) return []
  const out = new Set([d])

  // Lógica de 9º dígito para Brasil
  // Formatos: 55 + DDD + [9] + 8 dígitos
  if (d.length >= 10) {
    const isE164 = d.startsWith('55')
    const core = isE164 ? d.slice(2) : d
    const ddd = core.slice(0, 2)
    const rest = core.slice(2)

    // Se tem 10 dígitos (DDD + 8), tenta adicionar o 9
    if (core.length === 10) {
      const with9 = `${ddd}9${rest}`
      out.add(with9)
      if (isE164) out.add(`55${with9}`)
    }
    // Se tem 11 dígitos (DDD + 9 + 8), tenta remover o 9
    else if (core.length === 11 && rest.startsWith('9')) {
      const without9 = `${ddd}${rest.slice(1)}`
      out.add(without9)
      if (isE164) out.add(`55${without9}`)
    }
  }

  const isE164Br13 = d.startsWith('55') && d.length === 13
  const nacional13 = isE164Br13 ? d.slice(2) : ''

  if (isE164Br13) {
    out.add(nacional13)
  } else if (d.startsWith('55') && d.length > 2) {
    out.add(d.slice(2))
  }

  if (!d.startsWith('55') && d.length >= 10 && d.length <= 15) {
    out.add(`55${d}`)
  }

  if (d.startsWith('55') && d.length > 13) {
    const core = d.slice(0, 13)
    out.add(core)
    out.add(core.slice(2))
  } else if (!d.startsWith('55') && d.length > 11) {
    const h11 = d.slice(0, 11)
    out.add(h11)
    out.add(`55${h11}`)
  }

  if (d.length >= 11) {
    const t11 = d.slice(-11)
    out.add(t11)
    out.add(`55${t11}`)
  }

  return [...out]
}

/** Quando só um usuário tem telefone que “casa” pelo sufixo (9–13 dígitos). */
function buscarUsuarioPorSufixoUnico(digitos, allUsers) {
  const d = String(digitos).replace(/\D/g, '')
  if (d.length < 8 || !allUsers?.length) return null

  for (const len of [13, 12, 11, 10, 9]) {
    if (d.length < len) continue
    const suf = d.slice(-len)
    const matches = allUsers.filter((u) => {
      const uc = String(u.telefone).replace(/\D/g, '')
      return uc === suf || uc.endsWith(suf) || suf.endsWith(uc)
    })
    if (matches.length === 1) return matches[0]
  }

  if (d.length >= 11) {
    const pre11 = d.slice(0, 11)
    const matches = allUsers.filter((u) => {
      const uc = String(u.telefone).replace(/\D/g, '')
      const nacional = uc.startsWith('55') ? uc.slice(2) : uc
      return nacional.slice(0, 11) === pre11 || nacional === pre11
    })
    if (matches.length === 1) return matches[0]
  }

  return null
}

/**
 * @param {string} telefoneLimpo
 * @param {{ usarGemini?: boolean }} [options] — default usarGemini true se GEMINI_API_KEY existir
 */
export async function buscarUsuarioPorTelefone(telefoneLimpo, options = {}) {
  const supabaseAdmin = getSupabaseAdmin()
  const variants = variantesTelefoneBrasil(telefoneLimpo)

  for (const v of variants) {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, email, telefone, whatsapp_id')
      .eq('telefone', v)
      .maybeSingle()

    if (error) break
    if (data) return data
  }

  const { data: allUsers, error: errAll } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email, telefone, whatsapp_id')
    .not('telefone', 'is', null)

  if (errAll || !allUsers?.length) return null

  const targetVariants = new Set(variantesTelefoneBrasil(telefoneLimpo))

  const found = allUsers.find((u) => {
    const uClean = String(u.telefone).replace(/\D/g, '')
    if (targetVariants.has(uClean)) return true
    const uVars = new Set(variantesTelefoneBrasil(uClean))
    for (const t of targetVariants) {
      if (uVars.has(t)) return true
    }
    return false
  })
  if (found) return found

  const bySuffix = buscarUsuarioPorSufixoUnico(telefoneLimpo, allUsers)
  if (bySuffix) return bySuffix

  // Fallback: busca por whatsapp_id (LID do WhatsApp) quando telefone não bate
  const { data: byWhatsappId } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email, telefone, whatsapp_id')
    .eq('whatsapp_id', telefoneLimpo)
    .maybeSingle()
  if (byWhatsappId) return byWhatsappId

  const usarGemini = options.usarGemini !== false
  if (usarGemini) {
    const geminiMatch = await resolverUsuarioIdPorTelefoneGemini(telefoneLimpo, allUsers)
    if (geminiMatch) return geminiMatch
  }

  return null
}

export async function getPerfilUsuario(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()

  const res = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('id', usuarioId)
    .single()

  if (res.error || !res.data) return null

  const row = normalizeUsuarioRow(stripSenha(res.data))
  return {
    ...row,
    role: row.role ?? 'USER',
    is_active: row.is_active !== false,
    last_login_at: row.last_login_at ?? null,
    isento_pagamento: row.isento_pagamento === true,
  }
}

export async function registrarLogWhatsApp(telefone, mensagem, status, detalhe, usuarioId = null) {
  const supabaseAdmin = getSupabaseAdmin()
  
  try {
    const { error } = await supabaseAdmin.from('whatsapp_logs').insert({
      telefone_remetente: telefone,
      mensagem_recebida: mensagem,
      status: status,
      detalhe_erro: detalhe,
      usuario_id: usuarioId
    })
    
    if (error) {
      log.error('[DB Log Error] falha ao salvar log do zap:', error)
    }
  } catch (err) {
    log.error('[DB Log Panic] erro inesperado ao salvar log:', err)
  }
}

export async function getWhatsappLogs(limit = 200) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('whatsapp_logs')
    .select('*, usuarios(email, nome)')
    .order('data_hora', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

function toAdminUsuarioDto(rawRow, latestByUser, approvedIds, financeMap) {
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
    mp_ultimo_status: latest?.status ?? null,
    mp_ultimo_amount: latest?.amount ?? null,
    mp_ultimo_em: latest?.updated_at ?? latest?.created_at ?? null,
    mp_ultimo_detalhe: latest?.status_detail ?? null,
    accumulatedRevenue: agg?.accumulatedRevenue ?? 0,
    monthlyRevenue: agg?.monthlyRevenue ?? 0,
    lastPaymentDate: agg?.lastPaymentDate ?? null,
    nextPaymentDate: n.assinatura_proxima_cobranca ?? null,
    dueDate: n.trial_ends_at ?? null,
    subscriptionStatus: n.assinatura_mp_status ?? null,
    billingCycle: null,
    planName: null,
    paymentStatus,
    isOverdue,
    daysToExpire,
    notes: null,
  }
}

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

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {object} query
 */
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
    // Re-seleciona com contagem exata
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

  const actor = actorUserId ? await getPerfilUsuario(actorUserId) : null
  const actorEmail = actor?.email

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

export async function getWhatsappStatus() {
  const supabaseAdmin = getSupabaseAdmin()
  
  // Buscar contagem total e última data
  const { data, error, count } = await supabaseAdmin
    .from('whatsapp_logs')
    .select('data_hora', { count: 'exact' })
    .order('data_hora', { ascending: false })
    .limit(1)

  if (error) throw error

  const lastPulse = data && data.length > 0 ? data[0].data_hora : null
  const ONLINE_WINDOW_MS = 30 * 60 * 1000 // 30 minutos sem atividade = offline
  const online = lastPulse ? Date.now() - new Date(lastPulse).getTime() < ONLINE_WINDOW_MS : false

  return {
    platform: 'Evolution API',
    totalLogs: count || 0,
    lastPulse,
    online,
  }
}


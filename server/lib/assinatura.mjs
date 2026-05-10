import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { isSuperAdminEmail } from './super-admin.mjs'
import { resolveEscopoUsuario } from './conta-familiar.mjs'
import { isAsaasForbiddenError, urlPortalAssinaturaAsaasPadrao } from './asaas.mjs'
import {
  sincronizarPagamentosPendentesDoUsuario,
  sincronizarSubscriptionUsuario,
  usuarioTemPagamentoAprovado,
} from './pagamentos-asaas.mjs'
import { sincronizarStripeUsuario } from './pagamentos-stripe.mjs'

export const TRIAL_DIAS = Number.parseInt(process.env.HORIZONTE_TRIAL_DIAS || '7', 10) || 7

/** Erro PostgREST/Postgres quando a coluna ainda não existe (migração não aplicada). */
function isMissingColumnError(err, column) {
  const msg = String(err?.message || err?.details || err || '')
  const code = String(err?.code || '')
  if (code === '42703') return true
  const c = String(column || '').trim()
  if (!c) return false
  return msg.includes(c) && (msg.includes('does not exist') || msg.includes('não existe'))
}

/** Valor vindo do Postgres/PostgREST — evita falhar por tipos inesperados. */
function rawIsentoPagamento(v) {
  return v === true || v === 'true' || v === 't' || v === 1 || v === '1'
}

/**
 * Lê `isento_pagamento` direto na base para o utilizador da sessão e o titular de cobrança (conta familiar).
 * Fonte única para alinhar com GET /api/pagamentos/config (getPerfilUsuario).
 */
export async function resolveIsentoPagamentoEscopo(actorUsuarioId, billingUsuarioId) {
  const supabase = getSupabaseAdmin()
  const a = String(actorUsuarioId || '').trim()
  const b = String(billingUsuarioId || '').trim()
  if (!a) return false
  const ids = a === b ? [a] : [...new Set([a, b])]
  try {
    const { data, error } = await supabase.from('usuarios').select('isento_pagamento').in('id', ids)
    if (error) {
      if (isMissingColumnError(error, 'isento_pagamento')) {
        log.warn('[resolveIsentoPagamentoEscopo] coluna isento_pagamento ausente; rode scripts/migrations/06_isento_pagamento_usuarios.sql')
      } else {
        log.warn('[resolveIsentoPagamentoEscopo]', error.message || error)
      }
      return false
    }
    if (!Array.isArray(data)) return false
    return data.some((r) => rawIsentoPagamento(r?.isento_pagamento))
  } catch (e) {
    log.warn('[resolveIsentoPagamentoEscopo] exceção:', e?.message || e)
    return false
  }
}

/** Assinatura Asaas sem cobrança ativa — INACTIVE (pausada) ou EXPIRED. */
const ASAAS_STATUS_BLOQUEIA_ACESSO = new Set(['inactive', 'expired'])

export function asaasSubscriptionBloqueiaAcesso(status) {
  const s = String(status || '').trim().toLowerCase()
  return s !== '' && ASAAS_STATUS_BLOQUEIA_ACESSO.has(s)
}

/** @deprecated use asaasSubscriptionBloqueiaAcesso */
export function mpStatusBloqueiaAcesso(status) {
  return asaasSubscriptionBloqueiaAcesso(status)
}

export function mensagemBloqueioAssinaturaAsaas(status) {
  const s = String(status || '').trim().toLowerCase()
  if (s === 'inactive') {
    return 'Sua assinatura está pausada no Asaas. Reative em Pagamento ou no portal Asaas para continuar.'
  }
  if (s === 'expired') {
    return 'Sua assinatura encerrou. Acesse Pagamento para assinar novamente e voltar a usar o app.'
  }
  return 'Assinatura inativa ou período de teste encerrado. Conclua o pagamento no aplicativo para continuar.'
}

function stripeSubscriptionLiberaAcesso(stripeStatus) {
  const s = String(stripeStatus || '').trim().toLowerCase()
  return s === 'active' || s === 'trialing'
}

function situacaoAssinatura({ trialActive, assinatura_paga_efetiva, assinatura_asaas_status, gwBloqueia }) {
  if (trialActive && !assinatura_paga_efetiva) return 'trial'
  if (gwBloqueia) return String(assinatura_asaas_status || '').toLowerCase() === 'inactive' ? 'pausada' : 'cancelada'
  if (assinatura_paga_efetiva) return 'ativo'
  if (trialActive) return 'trial'
  return 'inativa'
}

function addDaysIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

/**
 * No primeiro acesso após login, define trial_ends_at = agora + TRIAL_DIAS (UTC).
 */
export async function ensureTrialIniciado(usuarioId) {
  const uid = String(usuarioId || '').trim()
  if (!uid) throw new Error('usuarioId inválido')
  const supabase = getSupabaseAdmin()
  const { data: row, error: selErr } = await supabase
    .from('usuarios')
    .select('trial_ends_at')
    .eq('id', uid)
    .maybeSingle()

  if (selErr) throw selErr
  if (row?.trial_ends_at) return String(row.trial_ends_at)

  const ends = addDaysIso(TRIAL_DIAS)
  const { error: upErr } = await supabase.from('usuarios').update({ trial_ends_at: ends }).eq('id', uid)
  if (upErr) throw upErr
  return ends
}

/** Campos de assinatura sem falhar se colunas trial/bem_vindo ainda não existirem no banco. */
export async function fetchAssinaturaCamposUsuario(usuarioId) {
  const uid = String(usuarioId || '').trim()
  if (!uid) return {}
  const supabase = getSupabaseAdmin()

  let base = await supabase.from('usuarios').select('email, isento_pagamento').eq('id', uid).maybeSingle()
  if (base.error && isMissingColumnError(base.error, 'isento_pagamento')) {
    log.warn(
      '[fetchAssinaturaCamposUsuario] coluna isento_pagamento ausente; rode scripts/migrations/06_isento_pagamento_usuarios.sql'
    )
    base = await supabase.from('usuarios').select('email').eq('id', uid).maybeSingle()
  }
  if (base.error) {
    log.warn('[fetchAssinaturaCamposUsuario] base:', base.error.message || base.error)
    return {}
  }
  if (!base.data) return {}

  const out = {
    email: base.data.email,
    isento_pagamento: rawIsentoPagamento(base.data.isento_pagamento),
    trial_ends_at: null,
    bem_vindo_pagamento_visto_at: null,
  }

  const tTrial = await supabase.from('usuarios').select('trial_ends_at').eq('id', uid).maybeSingle()
  if (!tTrial.error && tTrial.data?.trial_ends_at != null) out.trial_ends_at = tTrial.data.trial_ends_at

  const tBv = await supabase.from('usuarios').select('bem_vindo_pagamento_visto_at').eq('id', uid).maybeSingle()
  if (!tBv.error && tBv.data?.bem_vindo_pagamento_visto_at != null) {
    out.bem_vindo_pagamento_visto_at = tBv.data.bem_vindo_pagamento_visto_at
  }

  const tGw = await supabase
    .from('usuarios')
    .select('asaas_subscription_id, assinatura_proxima_cobranca, assinatura_asaas_status')
    .eq('id', uid)
    .maybeSingle()
  if (!tGw.error && tGw.data) {
    out.asaas_subscription_id = tGw.data.asaas_subscription_id ?? null
    out.assinatura_proxima_cobranca = tGw.data.assinatura_proxima_cobranca ?? null
    out.assinatura_asaas_status = tGw.data.assinatura_asaas_status ?? null
  }

  out.stripe_subscription_id = null
  out.stripe_subscription_status = null
  const tStripe = await supabase
    .from('usuarios')
    .select('stripe_subscription_id, stripe_subscription_status')
    .eq('id', uid)
    .maybeSingle()
  if (!tStripe.error && tStripe.data) {
    out.stripe_subscription_id = tStripe.data.stripe_subscription_id ?? null
    out.stripe_subscription_status = tStripe.data.stripe_subscription_status ?? null
  } else if (tStripe.error && !isMissingColumnError(tStripe.error, 'stripe_subscription_id')) {
    log.warn('[fetchAssinaturaCamposUsuario] stripe:', tStripe.error.message || tStripe.error)
  }

  return out
}

export function computeAssinaturaFlags({
  email,
  isento_pagamento,
  trial_ends_at,
  bem_vindo_pagamento_visto_at,
  assinatura_paga,
  assinatura_asaas_status,
  stripe_subscription_status = null,
}) {
  if (isSuperAdminEmail(email) || isento_pagamento === true) {
    return {
      assinatura_paga: true,
      acesso_app_liberado: true,
      mostrar_bem_vindo_assinatura: false,
      assinatura_asaas_bloqueada: false,
      motivo_bloqueio_acesso: null,
      assinatura_situacao: isento_pagamento === true ? 'isento' : 'admin',
    }
  }

  const trialEnd = trial_ends_at ? new Date(trial_ends_at) : null
  const trialActive = trialEnd != null && !Number.isNaN(trialEnd.getTime()) && trialEnd > new Date()
  const stripeOk = stripeSubscriptionLiberaAcesso(stripe_subscription_status)
  const gwBloqueia = asaasSubscriptionBloqueiaAcesso(assinatura_asaas_status) && !stripeOk
  const pagoHistorico = assinatura_paga === true
  const pagoEfetivo = pagoHistorico && !gwBloqueia

  let acesso = pagoEfetivo || trialActive
  if (gwBloqueia && !trialActive) acesso = false

  const mostrarBemVindo =
    acesso && !bem_vindo_pagamento_visto_at && !pagoEfetivo && !gwBloqueia

  const motivoBloqueio =
    !acesso && gwBloqueia && !trialActive ? mensagemBloqueioAssinaturaAsaas(assinatura_asaas_status) : null

  const situacao = situacaoAssinatura({
    trialActive,
    assinatura_paga_efetiva: pagoEfetivo,
    assinatura_asaas_status,
    gwBloqueia,
  })

  return {
    assinatura_paga: pagoEfetivo,
    acesso_app_liberado: acesso,
    mostrar_bem_vindo_assinatura: mostrarBemVindo,
    assinatura_asaas_bloqueada: gwBloqueia && !trialActive,
    motivo_bloqueio_acesso: motivoBloqueio,
    assinatura_situacao: situacao,
  }
}

/**
 * Garante trial, lê campos e retorna objeto para merge no JSON do usuário (login / status).
 */
export async function buildAssinaturaUsuarioPayload(usuarioId, partialUser = {}) {
  const uid = String(usuarioId || '').trim()
  let billingUid = uid
  let escopoMembro = null
  try {
    escopoMembro = await resolveEscopoUsuario(uid)
    billingUid = escopoMembro.dataUsuarioId
  } catch (e) {
    log.warn('[buildAssinaturaUsuarioPayload] escopo conta familiar:', e?.message || e)
  }

  const membroConta = Boolean(escopoMembro?.isMembroConta && billingUid !== uid)

  let trialEnds = null
  try {
    trialEnds = await ensureTrialIniciado(billingUid)
  } catch (e) {
    log.warn('[buildAssinaturaUsuarioPayload] trial:', e?.message || e)
  }

  let row = await fetchAssinaturaCamposUsuario(billingUid)
  const emailParaFlagsEarly = row.email ?? ''
  const emailExibicao = partialUser.email ?? emailParaFlagsEarly ?? ''

  await sincronizarPagamentosPendentesDoUsuario(billingUid).catch((e) => {
    if (isAsaasForbiddenError(e)) {
      log.debug('[buildAssinaturaUsuarioPayload] sync Asaas 401/403:', e?.message || e)
      return
    }
    log.warn('[buildAssinaturaUsuarioPayload] sync pagamentos:', e?.message || e)
  })
  await sincronizarSubscriptionUsuario(billingUid).catch((e) => {
    if (isAsaasForbiddenError(e)) {
      log.debug('[buildAssinaturaUsuarioPayload] sync subscription 401/403:', e?.message || e)
      return
    }
    log.warn('[buildAssinaturaUsuarioPayload] sync subscription:', e?.message || e)
  })
  await sincronizarStripeUsuario(billingUid).catch((e) => {
    log.warn('[buildAssinaturaUsuarioPayload] sync stripe:', e?.message || e)
  })

  row = await fetchAssinaturaCamposUsuario(billingUid)

  const emailParaFlags = row.email ?? emailParaFlagsEarly ?? ''
  const isentoDb = await resolveIsentoPagamentoEscopo(uid, billingUid)
  const isento =
    isentoDb ||
    partialUser.isento_pagamento === true ||
    row.isento_pagamento === true

  const hasPay = await usuarioTemPagamentoAprovado(billingUid, emailParaFlags)
  const flags = computeAssinaturaFlags({
    email: emailParaFlags,
    isento_pagamento: isento,
    trial_ends_at: trialEnds || row.trial_ends_at,
    bem_vindo_pagamento_visto_at: row.bem_vindo_pagamento_visto_at,
    assinatura_paga: hasPay,
    assinatura_asaas_status: row.assinatura_asaas_status,
    stripe_subscription_status: row.stripe_subscription_status,
  })

  if (emailExibicao && isSuperAdminEmail(emailExibicao)) {
    const flagsAdmin = computeAssinaturaFlags({
      email: emailExibicao,
      isento_pagamento: true,
      trial_ends_at: trialEnds || row.trial_ends_at,
      bem_vindo_pagamento_visto_at: row.bem_vindo_pagamento_visto_at,
      assinatura_paga: true,
      assinatura_asaas_status: row.assinatura_asaas_status,
      stripe_subscription_status: row.stripe_subscription_status,
    })
    const precoMensalAdm = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10')
    const planoPrecoAdm = Number.isFinite(precoMensalAdm) && precoMensalAdm > 0 ? precoMensalAdm : 10
    return {
      trial_ends_at: trialEnds || row.trial_ends_at || null,
      bem_vindo_pagamento_visto_at: row.bem_vindo_pagamento_visto_at || null,
      isento_pagamento: isento,
      assinatura_paga: flagsAdmin.assinatura_paga,
      acesso_app_liberado: flagsAdmin.acesso_app_liberado,
      mostrar_bem_vindo_assinatura: flagsAdmin.mostrar_bem_vindo_assinatura,
      trial_dias_gratis: TRIAL_DIAS,
      assinatura_proxima_cobranca: row.assinatura_proxima_cobranca ?? null,
      assinatura_asaas_status: row.assinatura_asaas_status ?? null,
      plano_preco_mensal: planoPrecoAdm,
      assinatura_situacao: flagsAdmin.assinatura_situacao,
      assinatura_asaas_bloqueada: flagsAdmin.assinatura_asaas_bloqueada,
      motivo_bloqueio_acesso: flagsAdmin.motivo_bloqueio_acesso,
      asaas_portal_url: null,
      conta_familiar_membro: membroConta || undefined,
      familia_papel: escopoMembro?.familiaPapel ?? undefined,
      conta_familiar_titular_id: membroConta ? billingUid : undefined,
    }
  }

  const precoMensal = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10')
  const planoPreco = Number.isFinite(precoMensal) && precoMensal > 0 ? precoMensal : 10

  const portalLink =
    !isento && !isSuperAdminEmail(emailParaFlags) ? (membroConta ? null : urlPortalAssinaturaAsaasPadrao()) : null

  const base = {
    trial_ends_at: trialEnds || row.trial_ends_at || null,
    bem_vindo_pagamento_visto_at: row.bem_vindo_pagamento_visto_at || null,
    isento_pagamento: isento,
    assinatura_paga: flags.assinatura_paga,
    acesso_app_liberado: flags.acesso_app_liberado,
    mostrar_bem_vindo_assinatura: flags.mostrar_bem_vindo_assinatura,
    trial_dias_gratis: TRIAL_DIAS,
    assinatura_proxima_cobranca: row.assinatura_proxima_cobranca ?? null,
    assinatura_asaas_status: row.assinatura_asaas_status ?? null,
    plano_preco_mensal: planoPreco,
    assinatura_situacao: flags.assinatura_situacao,
    assinatura_asaas_bloqueada: flags.assinatura_asaas_bloqueada,
    motivo_bloqueio_acesso: flags.motivo_bloqueio_acesso,
    asaas_portal_url: portalLink,
  }

  if (membroConta) {
    return {
      ...base,
      mostrar_bem_vindo_assinatura: false,
      conta_familiar_membro: true,
      familia_papel: escopoMembro?.familiaPapel ?? null,
      conta_familiar_titular_id: billingUid,
    }
  }

  return base
}

export async function marcarBemVindoPagamentoVisto(usuarioId) {
  const uid = String(usuarioId || '').trim()
  let targetId = uid
  try {
    const escopo = await resolveEscopoUsuario(uid)
    targetId = escopo.dataUsuarioId
  } catch {
    /* mantém uid */
  }
  const supabase = getSupabaseAdmin()
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('usuarios')
    .update({ bem_vindo_pagamento_visto_at: nowIso })
    .eq('id', targetId)

  if (error) throw error
  return nowIso
}

/**
 * Sessão válida para API de pagamentos (histórico, checkout, Pix QR).
 * Não exige assinatura ativa nem trial — quem está bloqueado precisa destas rotas para pagar.
 * @returns {null | { status: number, message: string }}
 */
export async function assertSessaoRotasPagamento(usuarioId) {
  const uid = String(usuarioId || '').trim()
  if (!uid) return { status: 401, message: 'Não autorizado.' }

  let escopo
  try {
    escopo = await resolveEscopoUsuario(uid)
  } catch (e) {
    log.warn('[assertSessaoRotasPagamento] escopo:', e?.message || e)
    return { status: 401, message: 'Não autorizado.' }
  }

  const billingUid = escopo.dataUsuarioId
  const supabase = getSupabaseAdmin()

  const { data: actorPeek } = await supabase.from('usuarios').select('email').eq('id', uid).maybeSingle()
  const actorEmail = actorPeek?.email ?? ''
  if (actorEmail && isSuperAdminEmail(actorEmail)) {
    return null
  }

  const { data: billingRow, error: uerr } = await supabase.from('usuarios').select('id').eq('id', billingUid).maybeSingle()
  if (uerr) {
    log.warn('[assertSessaoRotasPagamento] leitura usuarios:', uerr.message || uerr)
    return { status: 401, message: 'Não autorizado.' }
  }
  if (!billingRow) return { status: 401, message: 'Não autorizado.' }

  return null
}

/**
 * Verifica trial/pagamento/isento/super-admin (sem alterar trial — isso ocorre no login).
 * @returns {null | { status: number, message: string }}
 */
export async function assertAcessoAppUsuario(usuarioId) {
  const uid = String(usuarioId || '').trim()
  if (!uid) return { status: 401, message: 'Não autorizado.' }

  let billingUid = uid
  try {
    const escopo = await resolveEscopoUsuario(uid)
    billingUid = escopo.dataUsuarioId
  } catch (e) {
    log.warn('[assertAcessoAppUsuario] escopo:', e?.message || e)
    return { status: 401, message: 'Não autorizado.' }
  }

  const supabase = getSupabaseAdmin()

  const { data: actorPeek } = await supabase.from('usuarios').select('email').eq('id', uid).maybeSingle()
  const actorEmail = actorPeek?.email ?? ''
  if (actorEmail && isSuperAdminEmail(actorEmail)) {
    return null
  }

  try {
    await ensureTrialIniciado(billingUid)
  } catch (e) {
    log.warn('[assertAcessoAppUsuario] ensureTrialIniciado:', e?.message || e)
  }

  let urow = null
  let uerr = null
  ;({ data: urow, error: uerr } = await supabase
    .from('usuarios')
    .select('email, isento_pagamento, trial_ends_at, bem_vindo_pagamento_visto_at, assinatura_asaas_status, stripe_subscription_status')
    .eq('id', billingUid)
    .maybeSingle())

  if (uerr && isMissingColumnError(uerr, 'isento_pagamento')) {
    log.warn(
      '[assertAcessoAppUsuario] coluna isento_pagamento ausente; usando false. Rode scripts/migrations/06_isento_pagamento_usuarios.sql'
    )
    ;({ data: urow, error: uerr } = await supabase
      .from('usuarios')
      .select('email, trial_ends_at, bem_vindo_pagamento_visto_at, assinatura_asaas_status')
      .eq('id', billingUid)
      .maybeSingle())
  }

  if (uerr && isMissingColumnError(uerr, 'stripe_subscription_status')) {
    ;({ data: urow, error: uerr } = await supabase
      .from('usuarios')
      .select('email, isento_pagamento, trial_ends_at, bem_vindo_pagamento_visto_at, assinatura_asaas_status')
      .eq('id', billingUid)
      .maybeSingle())
  }

  if (uerr) {
    log.warn('[assertAcessoAppUsuario] leitura usuarios:', uerr.message || uerr)
    return null
  }
  if (!urow) return { status: 401, message: 'Não autorizado.' }

  const trial_ends_at = urow.trial_ends_at ?? null

  const email = urow.email ?? ''
  const hasPay = await usuarioTemPagamentoAprovado(billingUid, email)

  const isento =
    (await resolveIsentoPagamentoEscopo(uid, billingUid)) ||
    ('isento_pagamento' in urow ? rawIsentoPagamento(urow.isento_pagamento) : false)

  const flags = computeAssinaturaFlags({
    email,
    isento_pagamento: isento,
    trial_ends_at,
    bem_vindo_pagamento_visto_at: urow.bem_vindo_pagamento_visto_at,
    assinatura_paga: hasPay,
    assinatura_asaas_status: urow.assinatura_asaas_status,
    stripe_subscription_status: urow.stripe_subscription_status ?? null,
  })

  if (!flags.acesso_app_liberado) {
    return {
      status: 403,
      message:
        flags.motivo_bloqueio_acesso ||
        'Assinatura inativa ou período de teste encerrado. Conclua o pagamento no aplicativo para continuar.',
    }
  }
  return null
}

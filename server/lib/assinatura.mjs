import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { isSuperAdminEmail } from './super-admin.mjs'
import {
  sincronizarPagamentosPendentesDoUsuario,
  sincronizarPreapprovalUsuario,
  usuarioTemPagamentoAprovado,
} from './pagamentos-mp.mjs'

export const TRIAL_DIAS = Number.parseInt(process.env.HORIZONTE_TRIAL_DIAS || '7', 10) || 7

/** Status MP em que a assinatura não cobra / não mantém acesso pago. */
const MP_STATUS_BLOQUEIA_ACESSO = new Set(['paused', 'cancelled', 'canceled'])

export function mpStatusBloqueiaAcesso(status) {
  const s = String(status || '').trim().toLowerCase()
  return s !== '' && MP_STATUS_BLOQUEIA_ACESSO.has(s)
}

export function mensagemBloqueioAssinaturaMp(status) {
  const s = String(status || '').trim().toLowerCase()
  if (s === 'paused') {
    return 'Sua assinatura está pausada no Mercado Pago. Reative o débito em Pagamento ou no site do MP para continuar.'
  }
  if (s === 'cancelled' || s === 'canceled') {
    return 'Sua assinatura foi cancelada. Acesse Pagamento para assinar novamente e voltar a usar o app.'
  }
  return 'Assinatura inativa ou período de teste encerrado. Conclua o pagamento no aplicativo para continuar.'
}

function situacaoAssinatura({ trialActive, assinatura_paga_efetiva, assinatura_mp_status, mpBloqueia }) {
  if (trialActive && !assinatura_paga_efetiva) return 'trial'
  if (mpBloqueia) return String(assinatura_mp_status || '').toLowerCase() === 'paused' ? 'pausada' : 'cancelada'
  if (assinatura_paga_efetiva) return 'ativo'
  if (trialActive) return 'trial'
  return 'inativa'
}

export function urlGerenciarMercadoPagoPadrão() {
  return String(process.env.MERCADO_PAGO_URL_GESTAO || 'https://www.mercadopago.com.br/subscriptions').trim()
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

  const base = await supabase.from('usuarios').select('email, isento_pagamento').eq('id', uid).maybeSingle()
  if (base.error) {
    log.warn('[fetchAssinaturaCamposUsuario] base:', base.error.message || base.error)
    return {}
  }
  if (!base.data) return {}

  const out = {
    email: base.data.email,
    isento_pagamento: base.data.isento_pagamento,
    trial_ends_at: null,
    bem_vindo_pagamento_visto_at: null,
  }

  const tTrial = await supabase.from('usuarios').select('trial_ends_at').eq('id', uid).maybeSingle()
  if (!tTrial.error && tTrial.data?.trial_ends_at != null) out.trial_ends_at = tTrial.data.trial_ends_at

  const tBv = await supabase.from('usuarios').select('bem_vindo_pagamento_visto_at').eq('id', uid).maybeSingle()
  if (!tBv.error && tBv.data?.bem_vindo_pagamento_visto_at != null) {
    out.bem_vindo_pagamento_visto_at = tBv.data.bem_vindo_pagamento_visto_at
  }

  const tMp = await supabase
    .from('usuarios')
    .select('mp_preapproval_id, assinatura_proxima_cobranca, assinatura_mp_status')
    .eq('id', uid)
    .maybeSingle()
  if (!tMp.error && tMp.data) {
    out.mp_preapproval_id = tMp.data.mp_preapproval_id ?? null
    out.assinatura_proxima_cobranca = tMp.data.assinatura_proxima_cobranca ?? null
    out.assinatura_mp_status = tMp.data.assinatura_mp_status ?? null
  }

  return out
}

export function computeAssinaturaFlags({
  email,
  isento_pagamento,
  trial_ends_at,
  bem_vindo_pagamento_visto_at,
  assinatura_paga,
  assinatura_mp_status,
}) {
  if (isSuperAdminEmail(email) || isento_pagamento === true) {
    return {
      assinatura_paga: true,
      acesso_app_liberado: true,
      mostrar_bem_vindo_assinatura: false,
      assinatura_mp_bloqueada: false,
      motivo_bloqueio_acesso: null,
      assinatura_situacao: isento_pagamento === true ? 'isento' : 'admin',
    }
  }

  const trialEnd = trial_ends_at ? new Date(trial_ends_at) : null
  const trialActive = trialEnd != null && !Number.isNaN(trialEnd.getTime()) && trialEnd > new Date()
  const mpBloqueia = mpStatusBloqueiaAcesso(assinatura_mp_status)
  const pagoHistorico = assinatura_paga === true
  const pagoEfetivo = pagoHistorico && !mpBloqueia

  let acesso = pagoEfetivo || trialActive
  if (mpBloqueia && !trialActive) acesso = false

  /* Boas-vindas: com acesso (trial ou similar) e ainda sem pagamento efetivo; não exibir se MP bloqueou (vai para /pagamento). */
  const mostrarBemVindo =
    acesso &&
    !bem_vindo_pagamento_visto_at &&
    !pagoEfetivo &&
    !mpBloqueia

  const motivoBloqueio = !acesso && mpBloqueia && !trialActive ? mensagemBloqueioAssinaturaMp(assinatura_mp_status) : null

  const situacao = situacaoAssinatura({
    trialActive,
    assinatura_paga_efetiva: pagoEfetivo,
    assinatura_mp_status,
    mpBloqueia,
  })

  return {
    assinatura_paga: pagoEfetivo,
    acesso_app_liberado: acesso,
    mostrar_bem_vindo_assinatura: mostrarBemVindo,
    assinatura_mp_bloqueada: mpBloqueia && !trialActive,
    motivo_bloqueio_acesso: motivoBloqueio,
    assinatura_situacao: situacao,
  }
}

/**
 * Garante trial, lê campos e retorna objeto para merge no JSON do usuário (login / status).
 */
export async function buildAssinaturaUsuarioPayload(usuarioId, partialUser = {}) {
  const uid = String(usuarioId || '').trim()
  let trialEnds = null
  try {
    trialEnds = await ensureTrialIniciado(uid)
  } catch (e) {
    log.warn('[buildAssinaturaUsuarioPayload] trial:', e?.message || e)
  }

  let row = await fetchAssinaturaCamposUsuario(uid)
  const email = partialUser.email ?? row.email ?? ''
  const isento = partialUser.isento_pagamento === true || row.isento_pagamento === true

  await sincronizarPagamentosPendentesDoUsuario(uid).catch((e) =>
    log.warn('[buildAssinaturaUsuarioPayload] sync MP:', e?.message || e)
  )
  await sincronizarPreapprovalUsuario(uid).catch((e) =>
    log.warn('[buildAssinaturaUsuarioPayload] sync preapproval:', e?.message || e)
  )

  row = await fetchAssinaturaCamposUsuario(uid)

  const hasPay = await usuarioTemPagamentoAprovado(uid, email)
  const flags = computeAssinaturaFlags({
    email,
    isento_pagamento: isento,
    trial_ends_at: trialEnds || row.trial_ends_at,
    bem_vindo_pagamento_visto_at: row.bem_vindo_pagamento_visto_at,
    assinatura_paga: hasPay,
    assinatura_mp_status: row.assinatura_mp_status,
  })

  const precoMensal = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10')
  const planoPreco = Number.isFinite(precoMensal) && precoMensal > 0 ? precoMensal : 10

  const mpLink =
    !isento && !isSuperAdminEmail(email) ? urlGerenciarMercadoPagoPadrão() : null

  return {
    trial_ends_at: trialEnds || row.trial_ends_at || null,
    bem_vindo_pagamento_visto_at: row.bem_vindo_pagamento_visto_at || null,
    assinatura_paga: flags.assinatura_paga,
    acesso_app_liberado: flags.acesso_app_liberado,
    mostrar_bem_vindo_assinatura: flags.mostrar_bem_vindo_assinatura,
    trial_dias_gratis: TRIAL_DIAS,
    assinatura_proxima_cobranca: row.assinatura_proxima_cobranca ?? null,
    assinatura_mp_status: row.assinatura_mp_status ?? null,
    plano_preco_mensal: planoPreco,
    assinatura_situacao: flags.assinatura_situacao,
    assinatura_mp_bloqueada: flags.assinatura_mp_bloqueada,
    motivo_bloqueio_acesso: flags.motivo_bloqueio_acesso,
    mp_gerenciar_url: mpLink,
  }
}

export async function marcarBemVindoPagamentoVisto(usuarioId) {
  const uid = String(usuarioId || '').trim()
  const supabase = getSupabaseAdmin()
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('usuarios')
    .update({ bem_vindo_pagamento_visto_at: nowIso })
    .eq('id', uid)

  if (error) throw error
  return nowIso
}

/**
 * Verifica trial/pagamento/isento/super-admin (sem alterar trial — isso ocorre no login).
 * @returns {null | { status: number, message: string }}
 */
export async function assertAcessoAppUsuario(usuarioId) {
  const uid = String(usuarioId || '').trim()
  if (!uid) return { status: 401, message: 'Não autorizado.' }

  try {
    await ensureTrialIniciado(uid)
  } catch (e) {
    log.warn('[assertAcessoAppUsuario] ensureTrialIniciado:', e?.message || e)
  }

  const supabase = getSupabaseAdmin()
  const { data: urow, error: uerr } = await supabase
    .from('usuarios')
    .select('email, isento_pagamento, trial_ends_at, bem_vindo_pagamento_visto_at, assinatura_mp_status')
    .eq('id', uid)
    .maybeSingle()

  if (uerr) {
    log.warn('[assertAcessoAppUsuario] leitura usuarios:', uerr.message || uerr)
    return null
  }
  if (!urow) return { status: 401, message: 'Não autorizado.' }

  const trial_ends_at = urow.trial_ends_at ?? null

  const email = urow.email ?? ''
  const hasPay = await usuarioTemPagamentoAprovado(uid, email)

  const flags = computeAssinaturaFlags({
    email,
    isento_pagamento: urow.isento_pagamento === true,
    trial_ends_at,
    bem_vindo_pagamento_visto_at: urow.bem_vindo_pagamento_visto_at,
    assinatura_paga: hasPay,
    assinatura_mp_status: urow.assinatura_mp_status,
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

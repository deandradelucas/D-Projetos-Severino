import { getSupabaseAdmin } from './supabase-admin.mjs'
import { isSuperAdminEmail } from './super-admin.mjs'
import { sincronizarPagamentosPendentesDoUsuario, usuarioTemPagamentoAprovado } from './pagamentos-mp.mjs'

export const TRIAL_DIAS = Number.parseInt(process.env.HORIZONTE_TRIAL_DIAS || '7', 10) || 7

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
    console.warn('[fetchAssinaturaCamposUsuario] base:', base.error.message || base.error)
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

  return out
}

export function computeAssinaturaFlags({
  email,
  isento_pagamento,
  trial_ends_at,
  bem_vindo_pagamento_visto_at,
  assinatura_paga,
}) {
  if (isSuperAdminEmail(email) || isento_pagamento === true) {
    return {
      assinatura_paga: true,
      acesso_app_liberado: true,
      mostrar_bem_vindo_assinatura: false,
    }
  }

  const trialEnd = trial_ends_at ? new Date(trial_ends_at) : null
  const trialActive = trialEnd != null && !Number.isNaN(trialEnd.getTime()) && trialEnd > new Date()
  const acesso = assinatura_paga === true || trialActive
  /* Tela de boas-vindas é para trial / antes de concluir o fluxo; quem já pagou não deve ver ao abrir o app. */
  const mostrarBemVindo =
    acesso && !bem_vindo_pagamento_visto_at && assinatura_paga !== true

  return {
    assinatura_paga: assinatura_paga === true,
    acesso_app_liberado: acesso,
    mostrar_bem_vindo_assinatura: mostrarBemVindo,
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
    console.warn('[buildAssinaturaUsuarioPayload] trial:', e?.message || e)
  }

  const row = await fetchAssinaturaCamposUsuario(uid)
  const email = partialUser.email ?? row.email ?? ''
  const isento = partialUser.isento_pagamento === true || row.isento_pagamento === true

  await sincronizarPagamentosPendentesDoUsuario(uid).catch((e) =>
    console.warn('[buildAssinaturaUsuarioPayload] sync MP:', e?.message || e)
  )

  const hasPay = await usuarioTemPagamentoAprovado(uid, email)
  const flags = computeAssinaturaFlags({
    email,
    isento_pagamento: isento,
    trial_ends_at: trialEnds || row.trial_ends_at,
    bem_vindo_pagamento_visto_at: row.bem_vindo_pagamento_visto_at,
    assinatura_paga: hasPay,
  })

  return {
    trial_ends_at: trialEnds || row.trial_ends_at || null,
    bem_vindo_pagamento_visto_at: row.bem_vindo_pagamento_visto_at || null,
    assinatura_paga: flags.assinatura_paga,
    acesso_app_liberado: flags.acesso_app_liberado,
    mostrar_bem_vindo_assinatura: flags.mostrar_bem_vindo_assinatura,
    trial_dias_gratis: TRIAL_DIAS,
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
    console.warn('[assertAcessoAppUsuario] ensureTrialIniciado:', e?.message || e)
  }

  const supabase = getSupabaseAdmin()
  const { data: urow, error: uerr } = await supabase
    .from('usuarios')
    .select('email, isento_pagamento')
    .eq('id', uid)
    .maybeSingle()

  if (uerr) {
    console.warn('[assertAcessoAppUsuario] leitura usuarios:', uerr.message || uerr)
    return null
  }
  if (!urow) return { status: 401, message: 'Não autorizado.' }

  let trial_ends_at = null
  const tr = await supabase.from('usuarios').select('trial_ends_at').eq('id', uid).maybeSingle()
  if (!tr.error && tr.data?.trial_ends_at != null) trial_ends_at = tr.data.trial_ends_at

  const email = urow.email ?? ''
  const hasPay = await usuarioTemPagamentoAprovado(uid, email)

  const flags = computeAssinaturaFlags({
    email,
    isento_pagamento: urow.isento_pagamento === true,
    trial_ends_at,
    bem_vindo_pagamento_visto_at: true,
    assinatura_paga: hasPay,
  })

  if (!flags.acesso_app_liberado) {
    return {
      status: 403,
      message:
        'Assinatura inativa ou período de teste encerrado. Conclua o pagamento no aplicativo para continuar.',
    }
  }
  return null
}

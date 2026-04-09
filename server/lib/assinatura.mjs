import { getSupabaseAdmin } from './supabase-admin.mjs'
import { isSuperAdminEmail } from './super-admin.mjs'
import { usuarioTemPagamentoAprovado } from './pagamentos-mp.mjs'

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
  const supabase = getSupabaseAdmin()
  const { data: row, error: selErr } = await supabase
    .from('usuarios')
    .select('trial_ends_at')
    .eq('id', usuarioId)
    .maybeSingle()

  if (selErr) throw selErr
  if (row?.trial_ends_at) return String(row.trial_ends_at)

  const ends = addDaysIso(TRIAL_DIAS)
  const { error: upErr } = await supabase.from('usuarios').update({ trial_ends_at: ends }).eq('id', usuarioId)
  if (upErr) throw upErr
  return ends
}

export async function fetchAssinaturaCamposUsuario(usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('usuarios')
    .select('trial_ends_at, bem_vindo_pagamento_visto_at, isento_pagamento, email')
    .eq('id', usuarioId)
    .maybeSingle()

  if (error) throw error
  return data || {}
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
  const mostrarBemVindo = acesso && !bem_vindo_pagamento_visto_at

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
  const trialEnds = await ensureTrialIniciado(usuarioId)
  const row = await fetchAssinaturaCamposUsuario(usuarioId)
  const email = partialUser.email ?? row.email ?? ''
  const isento = partialUser.isento_pagamento === true || row.isento_pagamento === true
  const hasPay = await usuarioTemPagamentoAprovado(usuarioId)
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
  }
}

export async function marcarBemVindoPagamentoVisto(usuarioId) {
  const supabase = getSupabaseAdmin()
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('usuarios')
    .update({ bem_vindo_pagamento_visto_at: nowIso })
    .eq('id', usuarioId)

  if (error) throw error
  return nowIso
}

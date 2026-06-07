import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { resolveEscopoUsuario } from './conta-familiar.mjs'
import { addDaysIso } from './assinatura-flags.mjs'

export const TRIAL_DIAS = Number.parseInt(process.env.HORIZONTE_TRIAL_DIAS || '7', 10) || 7

/**
 * Erro PostgREST/Postgres quando a coluna ainda não existe (migração não aplicada).
 *
 * IMPORTANTE: Postgres usa o código `42703` para qualquer "column does not exist",
 * sem distinguir qual coluna está faltando. Por isso é obrigatório casar o nome da
 * coluna na mensagem — caso contrário, qualquer SELECT que misture várias colunas
 * faria todos os `isMissingColumnError(err, 'foo')` retornarem `true` quando na
 * verdade só uma das colunas está ausente, disparando fallbacks errados.
 */
export function isMissingColumnError(err, column) {
  const msg = String(err?.message || err?.details || err || '')
  const code = String(err?.code || '')
  const c = String(column || '').trim()
  if (!c) return code === '42703'
  const mentionsColumn = msg.includes(c)
  if (code === '42703') return mentionsColumn
  return mentionsColumn && (msg.includes('does not exist') || msg.includes('não existe'))
}

/** Valor vindo do Postgres/PostgREST — evita falhar por tipos inesperados. */
export function rawIsentoPagamento(v) {
  return v === true || v === 'true' || v === 't' || v === 1 || v === '1'
}

/**
 * Lê `isento_pagamento` direto na base para o utilizador da sessão e o titular de cobrança (conta familiar).
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

  // Fast path: 1 query com todas as colunas (antes eram 4 round-trips sequenciais
  // por causa de fallbacks defensivos de migração). Auditoria squad 2026-06, A5/BACKEND-3.
  const ALL_COLS =
    'email, isento_pagamento, trial_ends_at, bem_vindo_pagamento_visto_at, asaas_subscription_id, assinatura_proxima_cobranca, assinatura_asaas_status'
  const one = await supabase.from('usuarios').select(ALL_COLS).eq('id', uid).maybeSingle()
  if (!one.error) {
    if (!one.data) return {}
    const d = one.data
    return {
      email: d.email,
      isento_pagamento: rawIsentoPagamento(d.isento_pagamento),
      trial_ends_at: d.trial_ends_at ?? null,
      bem_vindo_pagamento_visto_at: d.bem_vindo_pagamento_visto_at ?? null,
      asaas_subscription_id: d.asaas_subscription_id ?? null,
      assinatura_proxima_cobranca: d.assinatura_proxima_cobranca ?? null,
      assinatura_asaas_status: d.assinatura_asaas_status ?? null,
    }
  }

  // Fallback progressivo: só se alguma coluna não existir no banco (42703).
  if (!isMissingColumnError(one.error)) {
    log.warn('[fetchAssinaturaCamposUsuario] base:', one.error.message || one.error)
    return {}
  }
  log.warn('[fetchAssinaturaCamposUsuario] coluna ausente; usando fallback progressivo (rode as migrations pendentes)')

  let base = await supabase.from('usuarios').select('email, isento_pagamento').eq('id', uid).maybeSingle()
  if (base.error && isMissingColumnError(base.error, 'isento_pagamento')) {
    base = await supabase.from('usuarios').select('email').eq('id', uid).maybeSingle()
  }
  if (base.error || !base.data) return {}

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
  return out
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

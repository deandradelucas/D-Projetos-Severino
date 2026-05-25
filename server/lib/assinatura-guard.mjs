import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { isSuperAdminEmail } from './super-admin.mjs'
import { resolveEscopoUsuario } from './conta-familiar.mjs'
import { usuarioTemPagamentoAprovado } from './pagamentos-asaas.mjs'
import { computeAssinaturaFlags } from './assinatura-flags.mjs'
import { isStripeConfigured } from './stripe-client.mjs'
import {
  isMissingColumnError,
  rawIsentoPagamento,
  resolveIsentoPagamentoEscopo,
  ensureTrialIniciado,
} from './assinatura-db.mjs'

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

  // Só inclui colunas Stripe quando o gateway está configurado — caso contrário
  // o SELECT falha com 42703 (coluna inexistente) e dispara fallbacks ruidosos.
  const stripeOn = isStripeConfigured()
  const baseCols = 'email, isento_pagamento, trial_ends_at, bem_vindo_pagamento_visto_at, assinatura_asaas_status'
  const selectCols = stripeOn ? `${baseCols}, stripe_subscription_status` : baseCols

  let urow = null
  let uerr = null
  ;({ data: urow, error: uerr } = await supabase
    .from('usuarios')
    .select(selectCols)
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

  if (stripeOn && uerr && isMissingColumnError(uerr, 'stripe_subscription_status')) {
    ;({ data: urow, error: uerr } = await supabase
      .from('usuarios')
      .select(baseCols)
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

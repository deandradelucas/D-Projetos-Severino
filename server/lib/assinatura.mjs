import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { isSuperAdminEmail } from './super-admin.mjs'
import { resolveEscopoUsuario, countVinculosFamiliaTitular } from './conta-familiar.mjs'
import { isAsaasForbiddenError, urlPortalAssinaturaAsaasPadrao } from './asaas.mjs'
import {
  sincronizarPagamentosPendentesDoUsuario,
  sincronizarSubscriptionUsuario,
  usuarioTemPagamentoAprovado,
} from './pagamentos-asaas.mjs'
import { sincronizarStripeUsuario } from './pagamentos-stripe.mjs'
import {
  computeAssinaturaFlags,
  asaasSubscriptionBloqueiaAcesso,
  mpStatusBloqueiaAcesso,
  mensagemBloqueioAssinaturaAsaas,
  stripeSubscriptionLiberaAcesso,
  situacaoAssinatura,
  addDaysIso,
} from './assinatura-flags.mjs'
import {
  isMissingColumnError,
  rawIsentoPagamento,
  ensureTrialIniciado,
  fetchAssinaturaCamposUsuario,
  resolveIsentoPagamentoEscopo,
  marcarBemVindoPagamentoVisto,
} from './assinatura-db.mjs'
import { assertAcessoAppUsuario, assertSessaoRotasPagamento } from './assinatura-guard.mjs'

export const TRIAL_DIAS = Number.parseInt(process.env.HORIZONTE_TRIAL_DIAS || '7', 10) || 7

export {
  asaasSubscriptionBloqueiaAcesso,
  mpStatusBloqueiaAcesso,
  mensagemBloqueioAssinaturaAsaas,
  stripeSubscriptionLiberaAcesso,
  situacaoAssinatura,
  addDaysIso,
  computeAssinaturaFlags,
  isMissingColumnError,
  rawIsentoPagamento,
  ensureTrialIniciado,
  fetchAssinaturaCamposUsuario,
  resolveIsentoPagamentoEscopo,
  marcarBemVindoPagamentoVisto,
  assertAcessoAppUsuario,
  assertSessaoRotasPagamento,
}

/** Nome (ou identificador) do titular para quem é membro da conta familiar — sessão/UI. */
function pickTitularNomeExibicao(row) {
  if (!row || typeof row !== 'object') return null
  const nome = typeof row.nome === 'string' ? row.nome.trim() : ''
  if (nome) return nome
  const usuario = typeof row.usuario === 'string' ? row.usuario.trim() : ''
  if (usuario) return usuario
  const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''
  if (!email) return null
  const at = email.indexOf('@')
  if (at > 0) return email.slice(0, at)
  return email
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

  let familiaMostrarQuemLancou = false
  try {
    if (membroConta) familiaMostrarQuemLancou = true
    else {
      const n = await countVinculosFamiliaTitular(billingUid)
      familiaMostrarQuemLancou = n > 0
    }
  } catch (e) {
    log.warn('[buildAssinaturaUsuarioPayload] familia_mostrar_quem_lancou:', e?.message || e)
  }

  const familiaQuemLancouPayload = { familia_mostrar_quem_lancou: familiaMostrarQuemLancou }

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

  let contaFamiliarTitularNome = null
  if (membroConta && billingUid) {
    try {
      const supabase = getSupabaseAdmin()
      const tid = String(billingUid).trim()
      const { data: titRow, error: titErr } = await supabase
        .from('usuarios')
        .select('nome, usuario, email')
        .eq('id', tid)
        .maybeSingle()
      if (titErr) {
        log.warn('[buildAssinaturaUsuarioPayload] titular row:', titErr.message || titErr)
      } else if (titRow) {
        contaFamiliarTitularNome = pickTitularNomeExibicao(titRow)
      }
    } catch (e) {
      log.warn('[buildAssinaturaUsuarioPayload] conta_familiar_titular_nome:', e?.message || e)
    }
  }

  const familiaTitularNomePayload = membroConta
    ? { conta_familiar_titular_nome: contaFamiliarTitularNome }
    : { conta_familiar_titular_nome: null }

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
      ...familiaQuemLancouPayload,
      ...familiaTitularNomePayload,
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
      ...familiaQuemLancouPayload,
      ...familiaTitularNomePayload,
      mostrar_bem_vindo_assinatura: false,
      conta_familiar_membro: true,
      familia_papel: escopoMembro?.familiaPapel ?? null,
      conta_familiar_titular_id: billingUid,
    }
  }

  return { ...base, ...familiaQuemLancouPayload, ...familiaTitularNomePayload }
}

/**
 * Payload de fallback de assinatura usado quando buildAssinaturaUsuarioPayload falha.
 * Garante acesso temporário (acesso_app_liberado: true) para não bloquear o usuário por falha de infra.
 */
export function buildAssinaturaFallbackPayload(baseUser) {
  return {
    ...baseUser,
    trial_ends_at: null,
    bem_vindo_pagamento_visto_at: null,
    assinatura_paga: false,
    acesso_app_liberado: true,
    mostrar_bem_vindo_assinatura: false,
    trial_dias_gratis: 7,
    assinatura_proxima_cobranca: null,
    assinatura_asaas_status: null,
    plano_preco_mensal: Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10') || 10,
    assinatura_situacao: 'inativa',
    assinatura_asaas_bloqueada: false,
    motivo_bloqueio_acesso: null,
    asaas_portal_url: null,
    familia_mostrar_quem_lancou: false,
    conta_familiar_titular_nome: null,
  }
}

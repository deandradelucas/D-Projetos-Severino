import { isSuperAdminEmail } from './super-admin.mjs'

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

export function stripeSubscriptionLiberaAcesso(stripeStatus) {
  const s = String(stripeStatus || '').trim().toLowerCase()
  return s === 'active' || s === 'trialing'
}

export function situacaoAssinatura({ trialActive, assinatura_paga_efetiva, assinatura_asaas_status, gwBloqueia }) {
  if (trialActive && !assinatura_paga_efetiva) return 'trial'
  if (gwBloqueia) return String(assinatura_asaas_status || '').toLowerCase() === 'inactive' ? 'pausada' : 'cancelada'
  if (assinatura_paga_efetiva) return 'ativo'
  if (trialActive) return 'trial'
  return 'inativa'
}

export function addDaysIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
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

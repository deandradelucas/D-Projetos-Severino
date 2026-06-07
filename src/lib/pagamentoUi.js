// Derivações puras de UI da página de Pagamento.
// Extraídas de pages/Pagamento.jsx — sem React, testáveis.

export function pagamentoStatusBannerClass(statusUrl) {
  if (statusUrl === 'success') return 'pagamento-banner pagamento-banner--success'
  if (statusUrl === 'pending') return 'pagamento-banner pagamento-banner--warning'
  return 'pagamento-banner pagamento-banner--danger'
}

/** Cobrança ainda pode mudar de estado no Asaas — vale continuar a sincronizar. */
export function pagamentoHistoricoStatusPendente(status) {
  if (status == null || String(status).trim() === '') return false
  const s = String(status).toLowerCase()
  return s === 'pending' || s === 'in_process' || s === 'awaiting_risk_analysis'
}

/** Desconto (%) do plano anual vs 12× o mensal. 0 quando não há vantagem. */
export function computeDescontoAnual(precosCatalogo) {
  const base = precosCatalogo.mensal * 12
  if (base <= 0 || precosCatalogo.anual >= base) return 0
  return Math.round((1 - precosCatalogo.anual / base) * 100)
}

/** Dias restantes do trial (arredondado p/ cima), ou null se não está em trial/sem data. */
export function computeDiasRestantesTrial(painelAssinatura) {
  if (painelAssinatura.situacao !== 'trial' || !painelAssinatura.trialEndsAt) return null
  const end = new Date(painelAssinatura.trialEndsAt)
  if (Number.isNaN(end.getTime())) return null
  return Math.max(0, Math.ceil((end - new Date()) / 86_400_000))
}

/** Variante de urgência do trial: null | 'critico' | 'aviso' | 'normal'. */
export function trialUrgenciaVariant(diasRestantesTrial) {
  if (diasRestantesTrial === null) return null
  if (diasRestantesTrial <= 1) return 'critico'
  if (diasRestantesTrial <= 3) return 'aviso'
  return 'normal'
}

/** Mensagem de urgência conforme dias restantes do trial. */
export function trialUrgenciaMsg(diasRestantesTrial) {
  if (diasRestantesTrial === 0) return 'Seu período gratuito termina hoje. Assine agora para não perder o acesso.'
  if (diasRestantesTrial === 1) return 'Último dia de teste! Depois disso, você perde acesso ao app.'
  if (diasRestantesTrial <= 3) return 'Restam poucos dias. Assine para manter o controle financeiro que você construiu.'
  return 'Aproveite o período gratuito e assine antes de terminar para não perder o acesso.'
}

/** Progresso (%) do trial — mínimo visual de 6%. */
export function trialProgresso(diasRestantesTrial, total = 7) {
  if (diasRestantesTrial == null) return 0
  return Math.min(100, Math.max(6, ((total - diasRestantesTrial) / total) * 100))
}

/** Economia em R$ do plano anual vs 12× o mensal. */
export function computeEconomiaAnual(precosCatalogo) {
  return Math.max(0, precosCatalogo.mensal * 12 - precosCatalogo.anual)
}

/** Badge de status no hero: { tone, label } ou null. */
export function computeStatusBadge(painelAssinatura, config, expirado) {
  const s = painelAssinatura.situacao
  if (s === 'ativo' && painelAssinatura.paga) return { tone: 'ativo', label: 'Assinatura ativa' }
  if (s === 'trial') return { tone: 'trial', label: 'Período de teste' }
  if (s === 'admin') return { tone: 'ativo', label: 'Administrador' }
  if (config.isento_pagamento) return { tone: 'ativo', label: 'Conta isenta' }
  if (s === 'pausada') return { tone: 'aviso', label: 'Pausada' }
  if (s === 'cancelada' || s === 'inativa' || expirado) return { tone: 'expirado', label: 'Inativa' }
  return null
}

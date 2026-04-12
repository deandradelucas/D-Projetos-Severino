/**
 * Modelo e cópias da página Pagamento — alinhado ao payload de /api/assinatura/status e linhas de pagamentos_mercadopago.
 */

import { formatCurrencyBRL } from './formatCurrency.js'

export const PLANO_PADRAO_TITULO = 'Assinatura mensal Horizonte Financeiro'
export const PROVEDOR_PAGAMENTO_LABEL = 'Mercado Pago'

/** @typedef {{ id: string, status?: string|null, status_detail?: string|null, amount?: number|null, description?: string|null, external_reference?: string|null, preference_id?: string|null, preapproval_id?: string|null, payment_id?: string|null, created_at?: string|null }} PagamentoHistoricoRow */

/**
 * @param {string|undefined|null} status
 * @returns {string}
 */
export function pagamentoStatusLabelPt(status) {
  if (status == null || String(status).trim() === '') return '—'
  const s = String(status).toLowerCase()
  if (s === 'approved' || s === 'authorized' || s === 'accredited') return 'Aprovado'
  if (s === 'pending' || s === 'in_process') return 'Pendente'
  if (s === 'in_mediation') return 'Em análise'
  if (s === 'refunded') return 'Estornado'
  if (s === 'charged_back') return 'Contestado'
  if (s === 'rejected') return 'Recusado'
  if (s === 'cancelled') return 'Cancelado'
  return String(status)
}

/**
 * @param {string|undefined|null} code
 * @returns {string}
 */
export function situacaoAssinaturaLabel(code) {
  const m = {
    admin: 'Administrador',
    isento: 'Conta isenta de pagamento',
    trial: 'Período de teste',
    ativo: 'Assinatura ativa',
    pausada: 'Assinatura pausada no Mercado Pago',
    cancelada: 'Assinatura cancelada no Mercado Pago',
    inativa: 'Sem assinatura ativa',
  }
  return m[String(code || '')] || ''
}

/**
 * @param {Record<string, unknown>|null|undefined} u
 */
export function painelAssinaturaFromUser(u) {
  if (!u) {
    return {
      situacao: null,
      label: '',
      mpUrl: '',
      bloqueada: false,
      motivo: '',
      paga: false,
      mpStatus: null,
      trialEndsAt: null,
    }
  }
  const code = u.assinatura_situacao
  return {
    situacao: code != null ? String(code) : null,
    label: code ? situacaoAssinaturaLabel(String(code)) : '',
    mpUrl: typeof u.mp_gerenciar_url === 'string' ? u.mp_gerenciar_url.trim() : '',
    bloqueada: !!u.assinatura_mp_bloqueada,
    motivo: typeof u.motivo_bloqueio_acesso === 'string' ? u.motivo_bloqueio_acesso : '',
    paga: u.assinatura_paga === true,
    mpStatus: u.assinatura_mp_status != null ? String(u.assinatura_mp_status) : null,
    trialEndsAt: u.trial_ends_at != null ? String(u.trial_ends_at) : null,
  }
}

/**
 * @param {PagamentoHistoricoRow[]} historico
 * @returns {PagamentoHistoricoRow|null}
 */
export function ultimoPagamentoHistorico(historico) {
  if (!Array.isArray(historico) || historico.length === 0) return null
  return historico[0]
}

/**
 * @param {PagamentoHistoricoRow|undefined|null} row
 */
export function referenciaPagamentoCurta(row) {
  if (!row) return '—'
  const ext = row.external_reference && String(row.external_reference).trim()
  if (ext) return ext.length > 28 ? `${ext.slice(0, 14)}…${ext.slice(-8)}` : ext
  const pid = row.payment_id && String(row.payment_id).trim()
  if (pid) return `Pag. ${pid.length > 18 ? `${pid.slice(0, 10)}…` : pid}`
  const pref = row.preference_id && String(row.preference_id).trim()
  if (pref) return `Pref. ${pref.length > 16 ? `${pref.slice(0, 8)}…` : pref}`
  const pre = row.preapproval_id && String(row.preapproval_id).trim()
  if (pre) return `Assin. ${pre.length > 16 ? `${pre.slice(0, 8)}…` : pre}`
  return '—'
}

/**
 * @param {{
 *   painel: ReturnType<typeof painelAssinaturaFromUser>
 *   proximaCobranca: string|null
 *   precoMensal: number
 *   tituloPlano: string
 *   historico: PagamentoHistoricoRow[]
 * }} p
 */
export function buildResumoKpis(p) {
  const { painel, proximaCobranca, precoMensal, tituloPlano, historico } = p
  const ultimo = ultimoPagamentoHistorico(historico)
  let proximaLabel = '—'
  if (proximaCobranca) {
    const d = new Date(proximaCobranca)
    proximaLabel = Number.isNaN(d.getTime())
      ? String(proximaCobranca)
      : d.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
  }
  const ultimoStatus = ultimo ? pagamentoStatusLabelPt(ultimo.status) : '—'

  return [
    { key: 'status', label: 'Situação da assinatura', value: painel.label || '—', hint: painel.mpStatus ? `MP: ${painel.mpStatus}` : null },
    { key: 'plano', label: 'Plano', value: tituloPlano || PLANO_PADRAO_TITULO },
    { key: 'valor', label: 'Valor mensal', value: `${formatCurrencyBRL(precoMensal)} / mês`, hint: 'Cobrança recorrente' },
    { key: 'proxima', label: 'Próxima cobrança', value: proximaLabel },
    { key: 'provedor', label: 'Meio de pagamento', value: PROVEDOR_PAGAMENTO_LABEL },
    { key: 'ultima', label: 'Último pagamento (histórico)', value: ultimoStatus, hint: ultimo?.created_at ? new Date(ultimo.created_at).toLocaleString('pt-BR') : null },
  ]
}

/**
 * @param {{
 *   painel: ReturnType<typeof painelAssinaturaFromUser>
 *   configReady: boolean
 *   isento: boolean
 *   historicoLen: number
 * }} p
 */
export function buildOrientacaoUsuario(p) {
  const { painel, configReady, isento, historicoLen } = p

  if (painel.situacao === 'admin') {
    return {
      variant: 'neutral',
      title: 'Conta de administrador',
      body: 'Contas administrativas seguem as regras definidas pelo time Horizonte; não é necessário concluir checkout de assinatura aqui.',
    }
  }

  if (isento) {
    return {
      variant: 'success',
      title: 'Conta isenta',
      body: 'Sua conta não exige assinatura pelo Mercado Pago. O acesso ao app segue liberado conforme a regra do administrador.',
    }
  }

  if (!configReady) {
    return {
      variant: 'neutral',
      title: 'Pagamentos em configuração',
      body: 'O checkout do Mercado Pago ainda não está ativo neste ambiente. Quando estiver disponível, você poderá autorizar a assinatura aqui.',
    }
  }

  if (painel.situacao === 'ativo' && painel.paga) {
    return {
      variant: 'success',
      title: 'Tudo certo com sua assinatura',
      body: 'Sua assinatura está ativa e os pagamentos são renovados automaticamente no cartão autorizado no Mercado Pago, até você cancelar por lá.',
    }
  }

  if (painel.situacao === 'trial') {
    return {
      variant: 'neutral',
      title: 'Você está no período de teste',
      body: 'Aproveite o app gratuitamente durante o trial. Ao terminar, conclua a assinatura no Mercado Pago para manter o acesso.',
    }
  }

  if (painel.situacao === 'pausada') {
    return {
      variant: 'warning',
      title: 'Assinatura pausada',
      body: 'A cobrança recorrente está pausada no Mercado Pago. Use “Gerenciar no Mercado Pago” para ver detalhes ou reativar quando disponível.',
    }
  }

  if (painel.situacao === 'cancelada') {
    return {
      variant: 'danger',
      title: 'Assinatura cancelada',
      body: 'A renovação automática foi encerrada. Para voltar a usar o app com assinatura, inicie um novo fluxo de autorização no Mercado Pago.',
    }
  }

  if (painel.bloqueada && painel.motivo) {
    return {
      variant: 'danger',
      title: 'Acesso restrito',
      body: painel.motivo,
    }
  }

  if (painel.situacao === 'inativa' || !painel.paga) {
    return {
      variant: 'warning',
      title: 'Assinatura ainda não ativa',
      body: 'Conclua a autorização no Mercado Pago para ativar a cobrança mensal e liberar o acesso contínuo ao aplicativo.',
    }
  }

  if (historicoLen === 0) {
    return {
      variant: 'neutral',
      title: 'Sem cobranças registradas',
      body: 'Ainda não há pagamentos listados. Após a primeira autorização, o histórico aparecerá aqui com data, valor e status.',
    }
  }

  return {
    variant: 'neutral',
    title: 'Resumo',
    body: painel.label || 'Acompanhe abaixo o plano, valores e histórico de cobranças.',
  }
}

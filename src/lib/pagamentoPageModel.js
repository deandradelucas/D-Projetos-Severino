/**
 * Modelo e cópias da página Pagamento — alinhado ao payload de /api/assinatura/status e pagamentos_asaas.
 */

export const PLANO_PADRAO_TITULO = 'Assinatura mensal Severino'
export const PROVEDOR_PAGAMENTO_LABEL = 'Asaas'

/** @typedef {{ id: string, status?: string|null, status_detail?: string|null, amount?: number|null, description?: string|null, external_reference?: string|null, checkout_id?: string|null, subscription_id?: string|null, payment_id?: string|null, preference_id?: string|null, preapproval_id?: string|null, created_at?: string|null }} PagamentoHistoricoRow */

/**
 * @param {string|undefined|null} status
 * @returns {string}
 */
export function pagamentoStatusLabelPt(status) {
  if (status == null || String(status).trim() === '') return '—'
  const s = String(status).toLowerCase()
  if (s === 'approved' || s === 'authorized' || s === 'accredited' || s === 'received' || s === 'confirmed') return 'Aprovado'
  if (s === 'pending' || s === 'in_process') return 'Pendente'
  if (s === 'awaiting_risk_analysis') return 'Em análise'
  if (s === 'overdue') return 'Vencido'
  if (s === 'in_mediation') return 'Em mediação'
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
    pausada: 'Assinatura pausada no Asaas',
    cancelada: 'Assinatura encerrada no Asaas',
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
      portalUrl: '',
      bloqueada: false,
      motivo: '',
      paga: false,
      assinaturaGatewayStatus: null,
      trialEndsAt: null,
    }
  }
  const code = u.assinatura_situacao
  const portal =
    typeof u.asaas_portal_url === 'string'
      ? u.asaas_portal_url.trim()
      : typeof u.mp_gerenciar_url === 'string'
        ? u.mp_gerenciar_url.trim()
        : ''
  return {
    situacao: code != null ? String(code) : null,
    label: code ? situacaoAssinaturaLabel(String(code)) : '',
    portalUrl: portal,
    bloqueada: !!(u.assinatura_asaas_bloqueada ?? u.assinatura_mp_bloqueada),
    motivo: typeof u.motivo_bloqueio_acesso === 'string' ? u.motivo_bloqueio_acesso : '',
    paga: u.assinatura_paga === true,
    assinaturaGatewayStatus:
      u.assinatura_asaas_status != null
        ? String(u.assinatura_asaas_status)
        : u.assinatura_mp_status != null
          ? String(u.assinatura_mp_status)
          : null,
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
  const chk = row.checkout_id && String(row.checkout_id).trim()
  if (chk) return `Checkout ${chk.length > 14 ? `${chk.slice(0, 8)}…` : chk}`
  const sub = row.subscription_id && String(row.subscription_id).trim()
  if (sub) return `Assin. ${sub.length > 16 ? `${sub.slice(0, 8)}…` : sub}`
  const pref = row.preference_id && String(row.preference_id).trim()
  if (pref) return `Pref. ${pref.length > 16 ? `${pref.slice(0, 8)}…` : pref}`
  const pre = row.preapproval_id && String(row.preapproval_id).trim()
  if (pre) return `Assin. ${pre.length > 16 ? `${pre.slice(0, 8)}…` : pre}`
  return '—'
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
      body: 'Sem checkout de assinatura nesta conta.',
    }
  }

  if (isento) {
    return {
      variant: 'success',
      title: 'Conta isenta',
      body: 'Não é necessário pagar assinatura nesta conta.',
    }
  }

  if (!configReady) {
    return {
      variant: 'neutral',
      title: 'Pagamentos em configuração',
      body: 'O checkout será habilitado quando o servidor estiver configurado (Asaas).',
    }
  }

  if (painel.situacao === 'ativo' && painel.paga) {
    return {
      variant: 'success',
      title: 'Assinatura ativa',
      body: 'Renovação automática até você cancelar no portal Asaas.',
    }
  }

  if (painel.situacao === 'trial') {
    return {
      variant: 'neutral',
      title: 'Período de teste',
      body: 'Ao terminar, conclua a assinatura na página Pagamento para manter o acesso.',
    }
  }

  if (painel.situacao === 'pausada') {
    return {
      variant: 'warning',
      title: 'Assinatura pausada',
      body: 'Use “Portal Asaas” para detalhes ou regularizar a cobrança.',
    }
  }

  if (painel.situacao === 'cancelada') {
    return {
      variant: 'danger',
      title: 'Assinatura encerrada',
      body: 'Para voltar, inicie uma nova assinatura na página Pagamento.',
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
      title: 'Assinatura não ativa',
      body: 'Conclua o checkout seguro (cartão ou Pix) para liberar o acesso.',
    }
  }

  if (historicoLen === 0) {
    return {
      variant: 'neutral',
      title: 'Sem cobranças ainda',
      body: 'Após o primeiro pagamento, o histórico aparece abaixo.',
    }
  }

  return {
    variant: 'neutral',
    title: 'Resumo',
    body: painel.label || 'Veja plano e histórico ao lado.',
  }
}

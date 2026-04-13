/** Monta query string para GET /api/admin/usuarios */
export function buildUsuariosAdminQuery(params) {
  const sp = new URLSearchParams()
  sp.set('page', String(Math.max(1, Number(params.page) || 1)))
  sp.set('pageSize', String(Math.min(5000, Math.max(1, Number(params.pageSize) || 12))))
  if (params.q && String(params.q).trim()) sp.set('q', String(params.q).trim())
  if (params.role) sp.set('role', params.role)
  if (params.conta) sp.set('conta', params.conta)
  if (params.assinatura) sp.set('assinatura', params.assinatura)
  if (params.login) sp.set('login', params.login)
  if (params.createdFrom) sp.set('createdFrom', params.createdFrom)
  if (params.createdTo) sp.set('createdTo', params.createdTo)
  if (params.accessFrom) sp.set('accessFrom', params.accessFrom)
  if (params.accessTo) sp.set('accessTo', params.accessTo)
  if (params.payFrom) sp.set('payFrom', params.payFrom)
  if (params.payTo) sp.set('payTo', params.payTo)
  if (params.trialEndsFrom) sp.set('trialEndsFrom', params.trialEndsFrom)
  if (params.trialEndsTo) sp.set('trialEndsTo', params.trialEndsTo)
  if (params.sort && params.sort !== 'email_asc') sp.set('sort', params.sort)
  return sp.toString()
}

export function formatDatePtBr(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { dateStyle: 'short' })
}

export function formatDateTimePtBr(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** @param {string} key */
export function paymentStatusLabel(key) {
  const k = String(key || '').toLowerCase()
  const map = {
    isento: 'Isento',
    pago: 'Assinatura paga',
    trial_ativo: 'Trial ativo',
    inadimplente: 'Inadimplente',
    sem_trial: 'Sem trial',
    desconhecido: '—',
  }
  return map[k] || key || '—'
}

export function rowsToUsersAdminCsv(rows) {
  const cols = [
    'nome',
    'email',
    'telefone',
    'papel',
    'conta_ativa',
    'status_financeiro',
    'ganho_acumulado',
    'receita_mes',
    'proximo_pagamento',
    'vencimento_trial',
    'ultimo_pagamento',
    'ultimo_acesso',
    'cadastro',
  ]
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [cols.join(',')]
  for (const r of rows) {
    const papel = String(r.role || 'USER')
    const conta = r.is_active === false ? 'desativada' : 'ativa'
    const ult = r.last_login_at ? new Date(r.last_login_at).toISOString() : ''
    const cad = r.created_at ? new Date(r.created_at).toISOString() : ''
    lines.push(
      [
        esc(r.nome),
        esc(r.email),
        esc(r.telefone),
        esc(papel),
        esc(conta),
        esc(paymentStatusLabel(r.paymentStatus)),
        esc(r.accumulatedRevenue),
        esc(r.monthlyRevenue),
        esc(r.nextPaymentDate),
        esc(r.dueDate),
        esc(r.lastPaymentDate),
        esc(ult),
        esc(cad),
      ].join(',')
    )
  }
  return lines.join('\n')
}

import React from 'react'
import { pagamentoStatusLabelPt } from '../../lib/pagamentoPageModel.js'

export default function AssinaturaPagamentoCell({ row, isEditing, editForm, onField }) {
  if (isEditing) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!editForm.isento_pagamento} onChange={(e) => onField('isento_pagamento', e.target.checked)} />
        Isento de pagamento
      </label>
    )
  }

  if (row.isento_pagamento === true) {
    return (
      <div>
        <span className="admin-pill" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>
          Isento
        </span>
        <div className="admin-subline">Sem cobrança Asaas</div>
      </div>
    )
  }

  if (row.pagamento_aprovado) {
    const amt =
      row.pagamento_ultimo_amount != null && row.pagamento_ultimo_amount !== ''
        ? `R$ ${Number(row.pagamento_ultimo_amount).toFixed(2)}`
        : null
    const quando = row.pagamento_ultimo_em ? new Date(row.pagamento_ultimo_em) : null
    return (
      <div>
        <span className="admin-pill" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d' }}>
          Assinatura paga
        </span>
        {amt && <div className="admin-subline">{amt}</div>}
        {quando && !Number.isNaN(quando.getTime()) && (
          <div className="admin-subline">Atualizado {quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
        )}
      </div>
    )
  }

  const trialEnd = row.trial_ends_at ? new Date(row.trial_ends_at) : null
  const trialValid = trialEnd && !Number.isNaN(trialEnd.getTime())

  if (!trialValid) {
    return (
      <div>
        <span className="admin-pill" style={{ backgroundColor: 'rgba(148,163,184,0.2)', color: 'var(--text-secondary)' }}>
          Sem trial
        </span>
        <div className="admin-subline">Ainda sem período de teste (ex.: primeiro login não registrou)</div>
        {row.pagamento_ultimo_status && (
          <div className="admin-subline">Última cobrança: {pagamentoStatusLabelPt(row.pagamento_ultimo_status)}</div>
        )}
      </div>
    )
  }

  const trialActive = trialEnd > new Date()
  if (trialActive) {
    return (
      <div>
        <span className="admin-pill" style={{ backgroundColor: 'rgba(99,102,241,0.18)', color: '#4f46e5' }}>
          Teste ativo
        </span>
        <div className="admin-subline">Até {trialEnd.toLocaleDateString('pt-BR', { dateStyle: 'long' })}</div>
        {row.pagamento_ultimo_status && (
          <div className="admin-subline">Última cobrança: {pagamentoStatusLabelPt(row.pagamento_ultimo_status)}</div>
        )}
      </div>
    )
  }

  return (
    <div>
      <span className="admin-pill" style={{ backgroundColor: 'rgba(234,179,8,0.2)', color: '#a16207' }}>
        Teste encerrado
      </span>
      <div className="admin-subline">Sem pagamento aprovado</div>
      {row.pagamento_ultimo_status && (
        <div className="admin-subline">Última cobrança: {pagamentoStatusLabelPt(row.pagamento_ultimo_status)}</div>
      )}
    </div>
  )
}

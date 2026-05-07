import React from 'react'
import PagamentoStatusBadge from '../PagamentoStatusBadge'
import { paymentLogStatusLabel } from '../../lib/paymentLogsAdmin'

/**
 * Status de cobrança com rótulos em português e indicação de atraso operacional.
 * @param {{ status?: string|null, isOverdue?: boolean, className?: string }} props
 */
export default function PaymentLogStatusBadge({ status, isOverdue, className = '' }) {
  const label = paymentLogStatusLabel(status, isOverdue === true)
  return (
    <span className={`payment-log-status-wrap${className ? ` ${className}` : ''}`}>
      <PagamentoStatusBadge status={status} label={label} />
      {isOverdue ? (
        <span className="payment-log-status-wrap__overdue" title="Pendente há mais de 7 dias">
          Atrasado
        </span>
      ) : null}
    </span>
  )
}

import { PaymentBadge } from './ui/Badge'

export default function PagamentoStatusBadge({ status, label, className = '' }) {
  return <PaymentBadge status={status} label={label} className={className} />
}

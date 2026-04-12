/**
 * Card de orientação ao usuário conforme situação da assinatura.
 * @param {{ variant: 'success'|'warning'|'danger'|'neutral', title: string, body: string }} props
 */
export default function PagamentoOrientacaoCard({ variant, title, body }) {
  return (
    <div className={`pagamento-orientacao pagamento-orientacao--${variant}`} role="region" aria-label="Orientações">
      <h3 className="pagamento-orientacao__title">{title}</h3>
      <p className="pagamento-orientacao__body">{body}</p>
    </div>
  )
}

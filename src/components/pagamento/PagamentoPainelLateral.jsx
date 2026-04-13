import PagamentoOrientacaoCard from './PagamentoOrientacaoCard.jsx'

/**
 * Ações rápidas + orientação (coluna lateral desktop / bloco mobile).
 */
export default function PagamentoPainelLateral({
  orientacao,
  onAssinar,
  onAtualizar,
  paying,
  loading,
  configReady,
  isento,
  mpUrl,
  disabledAssinar,
  checkoutError,
}) {
  return (
    <aside className="pagamento-aside" aria-label="Ações e orientações">
      <div className="pagamento-aside__actions ref-panel">
        <h2 className="pagamento-aside__title">Ações</h2>
        <div className="pagamento-aside__btn-stack">
          <button
            type="button"
            className="btn-primary page-pagamento-cta"
            disabled={disabledAssinar || paying || loading}
            onClick={onAssinar}
          >
            {paying ? 'Redirecionando…' : 'Assinar no Mercado Pago'}
          </button>
          {mpUrl ? (
            <a className="btn-secondary pagamento-aside__btn-link" href={mpUrl} target="_blank" rel="noopener noreferrer">
              Gerenciar no Mercado Pago
            </a>
          ) : null}
          <button type="button" className="btn-secondary" disabled={loading} onClick={onAtualizar}>
            Atualizar status
          </button>
        </div>
        {!configReady && !loading ? (
          <p className="pagamento-aside__footnote">Configure o Mercado Pago no servidor para habilitar o checkout.</p>
        ) : null}
        {isento ? <p className="pagamento-aside__footnote">Conta isenta — sem pagamento aqui.</p> : null}
        {checkoutError ? <p className="pagamento-checkout-error">{checkoutError}</p> : null}
      </div>
      <PagamentoOrientacaoCard variant={orientacao.variant} title={orientacao.title} body={orientacao.body} />
    </aside>
  )
}

import PagamentoOrientacaoCard from './PagamentoOrientacaoCard.jsx'

/**
 * Ações rápidas + orientação (coluna lateral desktop / bloco mobile).
 */
export default function PagamentoPainelLateral({
  orientacao,
  onAssinar,
  onAtualizar,
  onVerHistorico,
  paying,
  loading,
  configReady,
  isento,
  mpUrl,
  disabledAssinar,
  checkoutError,
  mpHint,
}) {
  return (
    <aside className="pagamento-aside" aria-label="Ações e orientações">
      <div className="pagamento-aside__actions ref-panel">
        <h2 className="pagamento-aside__title">Ações rápidas</h2>
        <div className="pagamento-aside__btn-stack">
          <button
            type="button"
            className="btn-primary page-pagamento-cta"
            disabled={disabledAssinar || paying || loading}
            onClick={onAssinar}
          >
            {paying ? 'Redirecionando…' : 'Assinar / autorizar no Mercado Pago'}
          </button>
          {mpUrl ? (
            <a className="btn-secondary pagamento-aside__btn-link" href={mpUrl} target="_blank" rel="noopener noreferrer">
              Gerenciar assinatura no MP
            </a>
          ) : null}
          <button type="button" className="btn-secondary" disabled={loading} onClick={onAtualizar}>
            Atualizar status
          </button>
          <button type="button" className="btn-secondary" onClick={onVerHistorico}>
            Ver histórico completo
          </button>
        </div>
        {!configReady && !loading ? (
          <p className="pagamento-aside__footnote">Checkout indisponível até o Mercado Pago ser configurado no servidor.</p>
        ) : null}
        {isento ? <p className="pagamento-aside__footnote">Conta isenta — não é necessário assinar.</p> : null}
        {checkoutError ? <p className="pagamento-checkout-error">{checkoutError}</p> : null}
        {mpHint ? <p className="pagamento-mp-hint">{mpHint}</p> : null}
      </div>
      <PagamentoOrientacaoCard variant={orientacao.variant} title={orientacao.title} body={orientacao.body} />
    </aside>
  )
}

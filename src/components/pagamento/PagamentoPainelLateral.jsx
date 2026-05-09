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
  portalUrl,
  disabledAssinar,
  checkoutError,
  assinarLabel,
  cpfCnpj,
  onCpfCnpjChange,
  /** Segundo checkout (ex.: Stripe quando o primeiro é Pix Asaas). */
  onSegundoCheckout,
  segundoCheckoutLabel,
  disabledSegundoCheckout,
}) {
  return (
    <aside className="pagamento-aside" aria-label="Ações e orientações">
      <div className="pagamento-aside__actions ref-panel">
        <h2 className="pagamento-aside__title">Ações</h2>
        <div className="pagamento-aside__btn-stack">
          {typeof onCpfCnpjChange === 'function' && (
            <div className="pagamento-aside__cpf-field">
              <label htmlFor="cpf-cnpj-checkout" className="pagamento-aside__cpf-label">
                CPF ou CNPJ
              </label>
              <input
                id="cpf-cnpj-checkout"
                type="text"
                className="pagamento-aside__cpf-input"
                placeholder="000.000.000-00"
                value={cpfCnpj || ''}
                onChange={(e) => onCpfCnpjChange(e.target.value)}
                maxLength={18}
                disabled={paying || loading}
              />
            </div>
          )}
          <button
            type="button"
            className="btn-primary page-pagamento-cta"
            disabled={disabledAssinar || paying || loading}
            onClick={onAssinar}
          >
            {paying ? 'Redirecionando…' : assinarLabel || 'Assinar com Asaas'}
          </button>
          {typeof onSegundoCheckout === 'function' && segundoCheckoutLabel ? (
            <button
              type="button"
              className="btn-primary page-pagamento-cta"
              disabled={disabledSegundoCheckout || paying || loading}
              onClick={onSegundoCheckout}
            >
              {paying ? 'Redirecionando…' : segundoCheckoutLabel}
            </button>
          ) : null}
          {portalUrl ? (
            <a className="btn-secondary pagamento-aside__btn-link" href={portalUrl} target="_blank" rel="noopener noreferrer">
              Portal Asaas
            </a>
          ) : null}
          <button type="button" className="btn-secondary" disabled={loading} onClick={onAtualizar}>
            Atualizar status
          </button>
        </div>
        {!configReady && !loading ? (
          <p className="pagamento-aside__footnote">
            Configure <code>ASAAS_API_KEY</code> no servidor para habilitar o checkout de pagamentos.
          </p>
        ) : null}
        {isento ? <p className="pagamento-aside__footnote">Conta isenta — sem pagamento aqui.</p> : null}
        {checkoutError ? <p className="pagamento-checkout-error">{checkoutError}</p> : null}
      </div>
      <PagamentoOrientacaoCard variant={orientacao.variant} title={orientacao.title} body={orientacao.body} />
    </aside>
  )
}

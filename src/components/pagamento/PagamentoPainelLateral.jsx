import PagamentoOrientacaoCard from './PagamentoOrientacaoCard.jsx'

/**
 * Painel lateral — orientação + ações secundárias.
 * O checkout principal (CPF + botão Pagar) está no corpo da página.
 */
export default function PagamentoPainelLateral({
  orientacao,
  onAtualizar,
  paying,
  loading,
  configReady,
  isento,
  portalUrl,
}) {
  return (
    <aside className="pagamento-aside" aria-label="Ações e orientações">
      <div className="pagamento-aside__actions ref-panel">
        <h2 className="pagamento-aside__title">Ações</h2>
        <div className="pagamento-aside__btn-stack">
          {portalUrl ? (
            <a className="btn-secondary pagamento-aside__btn-link" href={portalUrl} target="_blank" rel="noopener noreferrer">
              Portal Asaas
            </a>
          ) : null}
          <button type="button" className="btn-secondary" disabled={loading || paying} onClick={onAtualizar}>
            Atualizar status
          </button>
        </div>
        {!configReady && !loading ? (
          <p className="pagamento-aside__footnote">
            Configure <code>ASAAS_API_KEY</code> no servidor para habilitar o checkout.
          </p>
        ) : null}
        {isento ? <p className="pagamento-aside__footnote">Conta isenta — sem pagamento aqui.</p> : null}
      </div>
      <PagamentoOrientacaoCard variant={orientacao.variant} title={orientacao.title} body={orientacao.body} />
    </aside>
  )
}

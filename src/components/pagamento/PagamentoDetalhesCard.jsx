import { PROVEDOR_PAGAMENTO_LABEL } from '../../lib/pagamentoPageModel.js'

/**
 * Detalhes textuais da assinatura (card único).
 */
export default function PagamentoDetalhesCard({
  tituloPlano,
  /** Valor do ciclo escolhido para novo checkout (mensal ou anual). */
  valorCicloSelecionado,
  /** 'mês' | 'ano' */
  unidadeCiclo,
  /** Texto curto dos meios aceitos no checkout (varia por plano). */
  meiosPagamentoResumo = 'Pix ou cartão de crédito',
  painel,
  proximaCobranca,
  formatCurrency,
}) {
  const proxima =
    proximaCobranca && !Number.isNaN(new Date(proximaCobranca).getTime())
      ? new Date(proximaCobranca).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
      : '—'

  return (
    <article className="ref-panel page-pagamento-detalhes" aria-labelledby="pagamento-detalhes-heading">
      <div className="ref-panel__head">
        <div>
          <h2 id="pagamento-detalhes-heading" className="ref-panel__title">
            Sua assinatura
          </h2>
          <p className="ref-panel__subtitle">
            Cobrança recorrente no {PROVEDOR_PAGAMENTO_LABEL} — {meiosPagamentoResumo}
          </p>
        </div>
      </div>
      <dl className="pagamento-detalhes-dl">
        <div className="pagamento-detalhes-dl__row">
          <dt>Plano</dt>
          <dd>{tituloPlano}</dd>
        </div>
        <div className="pagamento-detalhes-dl__row">
          <dt>Valor</dt>
          <dd>
            {formatCurrency(valorCicloSelecionado)} / {unidadeCiclo}{' '}
            <span className="pagamento-detalhes-dl__muted">(renovação automática)</span>
          </dd>
        </div>
        <div className="pagamento-detalhes-dl__row">
          <dt>Situação</dt>
          <dd>{painel.label || '—'}</dd>
        </div>
        <div className="pagamento-detalhes-dl__row">
          <dt>Próxima cobrança</dt>
          <dd>{proxima}</dd>
        </div>
      </dl>
    </article>
  )
}

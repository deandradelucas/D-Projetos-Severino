import { PROVEDOR_PAGAMENTO_LABEL } from '../../lib/pagamentoPageModel.js'

/**
 * Detalhes textuais da assinatura (card único).
 */
export default function PagamentoDetalhesCard({
  tituloPlano,
  precoMensal,
  painel,
  proximaCobranca,
  primeiroRegistroIso,
  formatCurrency,
}) {
  const periodicidade = 'Mensal (renovação automática)'
  const proxima =
    proximaCobranca && !Number.isNaN(new Date(proximaCobranca).getTime())
      ? new Date(proximaCobranca).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
      : '—'
  const criacao =
    primeiroRegistroIso && !Number.isNaN(new Date(primeiroRegistroIso).getTime())
      ? new Date(primeiroRegistroIso).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
      : '—'

  return (
    <article className="ref-panel page-pagamento-detalhes" aria-labelledby="pagamento-detalhes-heading">
      <div className="ref-panel__head">
        <div>
          <h2 id="pagamento-detalhes-heading" className="ref-panel__title">
            Detalhes da assinatura
          </h2>
          <p className="ref-panel__subtitle">Produto, valores e renovação automática via {PROVEDOR_PAGAMENTO_LABEL}</p>
        </div>
      </div>
      <dl className="pagamento-detalhes-dl">
        <div className="pagamento-detalhes-dl__row">
          <dt>Produto</dt>
          <dd>{tituloPlano}</dd>
        </div>
        <div className="pagamento-detalhes-dl__row">
          <dt>Valor</dt>
          <dd>{formatCurrency(precoMensal)} / mês</dd>
        </div>
        <div className="pagamento-detalhes-dl__row">
          <dt>Periodicidade</dt>
          <dd>{periodicidade}</dd>
        </div>
        <div className="pagamento-detalhes-dl__row">
          <dt>Situação</dt>
          <dd>{painel.label || '—'}</dd>
        </div>
        <div className="pagamento-detalhes-dl__row">
          <dt>Primeiro registro no histórico</dt>
          <dd>{criacao}</dd>
        </div>
        <div className="pagamento-detalhes-dl__row">
          <dt>Próxima renovação</dt>
          <dd>{proxima}</dd>
        </div>
        <div className="pagamento-detalhes-dl__row pagamento-detalhes-dl__row--note">
          <dt>Sobre a cobrança</dt>
          <dd>
            A assinatura é uma cobrança recorrente mensal. Você autoriza o cartão uma única vez no checkout do {PROVEDOR_PAGAMENTO_LABEL}; as
            renovações ocorrem automaticamente até você cancelar pela área &quot;Gerenciar&quot; do Mercado Pago.
          </dd>
        </div>
      </dl>
    </article>
  )
}

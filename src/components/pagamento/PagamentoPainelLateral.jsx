import PagamentoOrientacaoCard from './PagamentoOrientacaoCard.jsx'

export default function PagamentoPainelLateral({ orientacao }) {
  return (
    <aside className="pagamento-aside" aria-label="Orientações">
      <PagamentoOrientacaoCard variant={orientacao.variant} title={orientacao.title} body={orientacao.body} />
    </aside>
  )
}

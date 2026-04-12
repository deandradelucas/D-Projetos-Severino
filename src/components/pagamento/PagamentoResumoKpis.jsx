/**
 * Faixa de resumo no topo da página Pagamento (métricas escaneáveis).
 * @param {{ items: Array<{ key: string, label: string, value: string, hint?: string|null }> }} props
 */
export default function PagamentoResumoKpis({ items }) {
  return (
    <section className="pagamento-resumo" aria-label="Resumo da assinatura e cobranças">
      <h2 className="pagamento-resumo__heading">Visão geral</h2>
      <div className="pagamento-resumo__grid">
        {items.map((it) => (
          <article key={it.key} className="pagamento-stat">
            <p className="pagamento-stat__label">{it.label}</p>
            <p className="pagamento-stat__value">{it.value}</p>
            {it.hint ? <p className="pagamento-stat__hint">{it.hint}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}

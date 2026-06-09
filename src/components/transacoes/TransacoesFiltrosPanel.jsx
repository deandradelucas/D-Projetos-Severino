import React from 'react'

/**
 * Painel de filtros colapsável da página de Transações.
 *
 * Props:
 *   filters         — objeto com todos os filtros
 *   filtrosAbertos  — boolean
 *   categorias      — array de categorias
 *   onToggle        — fn() para abrir/fechar
 *   onChange        — fn(event) handler genérico de inputs/selects
 *   onClearFilters  — fn() para limpar todos os filtros
 */
export function TransacoesFiltrosPanel({
  filters,
  filtrosAbertos,
  categorias,
  onToggle,
  onChange,
  onClearFilters,
  filtroParceladasAtivo,
  onToggleParceladas,
}) {
  // Quantos filtros do formulário estão preenchidos (feedback no header)
  const activeCount = ['busca', 'tipo', 'categoria_id', 'dataInicio', 'dataFim', 'lancamentos']
    .reduce((n, k) => n + (filters[k] ? 1 : 0), 0)

  return (
    <article className="ref-panel page-transacoes-ref-filters">
      <div className="ref-panel__head page-transacoes-filters-head">
        <button
          type="button"
          className="page-transacoes-filters-toggle"
          id="transacoes-filtros-trigger"
          aria-expanded={filtrosAbertos}
          aria-controls="transacoes-filtros-fields"
          onClick={onToggle}
        >
          <span className="page-transacoes-filters-toggle__lead">
            <span className="ref-panel__title" role="heading" aria-level={2}>
              Filtros
            </span>
            {activeCount > 0 && (
              <span className="tx-filters-count" aria-label={`${activeCount} ${activeCount === 1 ? 'filtro ativo' : 'filtros ativos'}`}>
                {activeCount}
              </span>
            )}
          </span>
          <svg
            className={`page-transacoes-filters-toggle__chevron ${filtrosAbertos ? 'page-transacoes-filters-toggle__chevron--open' : ''}`}
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          className={`tx-parceladas-chip${filtroParceladasAtivo ? ' tx-parceladas-chip--active' : ''}`}
          onClick={onToggleParceladas}
          aria-pressed={filtroParceladasAtivo}
          title="Filtrar compras parceladas"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
            <path d="M2 10h20" stroke="currentColor" strokeWidth="2"/>
            <path d="M6 15h4M14 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Parceladas
        </button>
        {activeCount > 0 && (
          <button type="button" className="ref-panel__link ref-panel__link--button" onClick={onClearFilters}>
            Limpar filtros
          </button>
        )}
      </div>
      <div
        id="transacoes-filtros-fields"
        role="region"
        aria-labelledby="transacoes-filtros-trigger"
        hidden={!filtrosAbertos}
      >
        <div className="transacoes-filter-grid page-transacoes-filter-grid">
          <div className="filter-group transacoes-filter-grid__search">
            <label htmlFor="tx-busca">Busca</label>
            <input
              id="tx-busca"
              type="text"
              name="busca"
              placeholder="Ex: Aluguel, Supermercado…"
              className="filter-input"
              value={filters.busca}
              onChange={onChange}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="tx-cat">Categoria</label>
            <select id="tx-cat" name="categoria_id" className="filter-input" value={filters.categoria_id} onChange={onChange}>
              <option value="">Todas</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="tx-tipo">Tipo</label>
            <select id="tx-tipo" name="tipo" className="filter-input" value={filters.tipo} onChange={onChange}>
              <option value="">Todos</option>
              <option value="RECEITA">Receitas</option>
              <option value="DESPESA">Despesas</option>
            </select>
          </div>
          <div className="filter-group transacoes-filter-grid__lancamentos">
            <label htmlFor="tx-lancamentos">Lançamentos</label>
            <select
              id="tx-lancamentos"
              name="lancamentos"
              className="filter-input"
              value={filters.lancamentos}
              onChange={onChange}
            >
              <option value="">Todos</option>
              <option value="recorrentes">Recorrentes</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="tx-ini">Início</label>
            <input id="tx-ini" type="date" name="dataInicio" className="filter-input" value={filters.dataInicio} onChange={onChange} />
          </div>
          <div className="filter-group">
            <label htmlFor="tx-fim">Fim</label>
            <input id="tx-fim" type="date" name="dataFim" className="filter-input" value={filters.dataFim} onChange={onChange} />
          </div>
        </div>
      </div>
    </article>
  )
}

import React from 'react'
import { formatPctBr } from '../../lib/relatoriosUtils'

/** Corpo skeleton reutilizável dentro dos cards de gráfico. */
function RelatoriosChartSkelBody({ pie }) {
  return (
    <div
      className={
        pie
          ? 'relatorios-chart-card__body relatorios-chart-card__body--pie relatorios-chart-card__body--skeleton-only'
          : 'relatorios-chart-card__body relatorios-chart-card__body--skeleton-only'
      }
      aria-hidden
    />
  )
}

/** Mesmo grid dos gráficos reais: títulos fixos + área pulsante (evita "cards genéricos" + tabela falsa). */
export function RelatoriosChartsLoadingShell() {
  return (
    <div className="relatorios-charts relatorios-charts--initial-skeleton" aria-busy="true" aria-label="Carregando gráficos">
      <section className="relatorios-charts__section" aria-labelledby="rel-month-heading-skel">
        <h3 id="rel-month-heading-skel" className="relatorios-charts__section-title">
          Visão mensal
        </h3>
        <div className="relatorios-charts__section-grid">
          <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card relatorios-chart-card--wide">
            <div className="ref-panel__head">
              <div>
                <h2 className="ref-panel__title">Evolução mensal</h2>
                <p className="ref-panel__subtitle">Receitas e despesas agregadas por mês no período</p>
              </div>
            </div>
            <RelatoriosChartSkelBody />
          </article>
        </div>
      </section>
      <div className="relatorios-charts__pair">
        <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card">
          <div className="ref-panel__head">
            <div>
              <h2 className="ref-panel__title">Despesas por categoria</h2>
              <p className="ref-panel__subtitle">Distribuição do que saiu no período</p>
            </div>
          </div>
          <RelatoriosChartSkelBody pie />
        </article>
        <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card">
          <div className="ref-panel__head">
            <div>
              <h2 className="ref-panel__title">Receitas por categoria</h2>
              <p className="ref-panel__subtitle">De onde entrou dinheiro no período</p>
            </div>
          </div>
          <RelatoriosChartSkelBody pie />
        </article>
      </div>
      <section className="relatorios-charts__section" aria-labelledby="rel-recorrentes-heading-skel">
        <h3 id="rel-recorrentes-heading-skel" className="relatorios-charts__section-title">
          Recorrentes
        </h3>
        <div className="relatorios-charts__section-grid">
          <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card relatorios-chart-card--wide">
            <div className="ref-panel__head">
              <div>
                <h2 className="ref-panel__title">Compras recorrentes por mês</h2>
                <p className="ref-panel__subtitle">Soma das despesas marcadas como recorrentes (regra mensal ou parcelamento) por mês</p>
              </div>
            </div>
            <RelatoriosChartSkelBody />
          </article>
        </div>
      </section>
    </div>
  )
}

/** Legenda ao lado do gráfico (fora do Recharts — layout responsivo estável). */
export function RelatorioPieLegendList({ rows, colorAt, total, formatCurrency }) {
  if (!rows?.length) return null
  return (
    <ul className="relatorios-pie-legend">
      {rows.map((row, i) => {
        const val = row.value
        const name = row.name
        return (
          <li key={`${String(name)}-${i}`} className="relatorios-pie-legend__item">
            <span className="relatorios-pie-legend__swatch" style={{ background: colorAt(i) }} aria-hidden />
            <div className="relatorios-pie-legend__body">
              <span className="relatorios-pie-legend__name">{name}</span>
              <span className="relatorios-pie-legend__meta">
                <span className="relatorios-pie-legend__pct">{formatPctBr(val, total)}</span>
                <span className="relatorios-pie-legend__val">{formatCurrency(val)}</span>
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Tooltip customizado para os gráficos de barras. */
export function RelatoriosTooltip({ active, payload, label, formatCurrency }) {
  if (!active || !payload?.length) return null
  return (
    <div className="relatorios-tooltip">
      <div className="relatorios-tooltip__label">{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="relatorios-tooltip__row">
          <span className="relatorios-tooltip__dot" style={{ background: p.color || '#94a3b8' }} />
          <span className="relatorios-tooltip__name">{p.name}</span>
          <span className="relatorios-tooltip__val">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

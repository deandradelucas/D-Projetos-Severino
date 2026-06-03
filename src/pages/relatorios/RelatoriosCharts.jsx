import React from 'react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { RelatorioPieLegendList, RelatoriosTooltip } from '../../components/relatorios/RelatoriosLoadingComponents'
import { formatPctBr } from '../../lib/relatoriosUtils'

/**
 * Bloco de gráficos do Relatório — isolado em chunk próprio (recharts é pesado).
 * Carregado via React.lazy a partir de Relatorios.jsx, para o shell da página
 * (hero, KPIs, insights, filtros) pintar sem esperar o recharts baixar.
 */
export default function RelatoriosCharts({
  refreshing,
  chartDataPorMes,
  chartDataSaldoAcumulado,
  chartDataPorCategoria,
  chartDataReceitasPorCategoria,
  chartDataComprasRecorrentesMes,
  totalComprasRecorrentesPeriodo,
  totalPieDesp,
  totalPieRec,
  orcadoVsReal,
  top5Despesas,
  isMobile,
  isDark,
  chart,
  formatCurrency,
  privacyMode,
  drillCategoria,
}) {
  return (
          <div className={`relatorios-charts${refreshing ? ' relatorios-charts--refreshing' : ''}`} aria-busy={refreshing}>

            {/* ── NEON LINE CHART ───────────────────────────────────────────────── */}
            <section className="relatorios-charts__section" aria-labelledby="rel-fluxo-heading">
              <h3 id="rel-fluxo-heading" className="relatorios-charts__section-title">Fluxo</h3>
              <div className="relatorios-charts__section-grid">
                <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card relatorios-chart-card--wide relatorios-neon-card">
                  <div className="ref-panel__head">
                    <div>
                      <h2 className="ref-panel__title">Fluxo do período</h2>
                      <p className="ref-panel__subtitle">Evolução de receitas e despesas</p>
                    </div>
                  </div>
                  <div className="relatorios-chart-card__body">
                    {chartDataPorMes.length > 0 ? (
                      <ResponsiveContainer width="100%" height={isMobile ? 240 : 300} debounce={50}>
                        <AreaChart data={chartDataPorMes} margin={{ top: 16, right: 8, left: 0, bottom: 4 }}>
                          <defs>
                            {isDark && (
                              <filter id="neonLineGlow" x="-30%" y="-30%" width="160%" height="160%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feMerge>
                                  <feMergeNode in="blur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            )}
                            <linearGradient id="neonAreaRec" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isDark ? '#00e5a0' : '#22c55e'} stopOpacity={isDark ? 0.22 : 0.35} />
                              <stop offset="95%" stopColor={isDark ? '#00e5a0' : '#22c55e'} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="neonAreaDes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isDark ? '#ff4d8d' : '#f43f5e'} stopOpacity={isDark ? 0.18 : 0.30} />
                              <stop offset="95%" stopColor={isDark ? '#ff4d8d' : '#f43f5e'} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 8"
                            stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            stroke="transparent"
                            fontSize={isMobile ? 10 : 11}
                            tickMargin={8}
                            tick={{ fill: isDark ? 'rgba(255,255,255,0.35)' : chart.tickFill }}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                            angle={isMobile ? -35 : 0}
                            textAnchor={isMobile ? 'end' : 'middle'}
                            height={isMobile ? 56 : 32}
                          />
                          <YAxis
                            stroke="transparent"
                            fontSize={isMobile ? 10 : 11}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: isDark ? 'rgba(255,255,255,0.35)' : chart.tickFill }}
                            tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`)}
                            width={isMobile ? 56 : 64}
                          />
                          <Tooltip
                            content={(props) => <RelatoriosTooltip {...props} formatCurrency={formatCurrency} />}
                            cursor={{ stroke: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', strokeWidth: 1, strokeDasharray: '4 4' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Receitas"
                            stroke={isDark ? '#00e5a0' : '#22c55e'}
                            strokeWidth={2.5}
                            fill="url(#neonAreaRec)"
                            dot={false}
                            activeDot={{ r: 5, fill: isDark ? '#00e5a0' : '#22c55e', strokeWidth: 0 }}
                            filter={isDark ? 'url(#neonLineGlow)' : undefined}
                          />
                          <Area
                            type="monotone"
                            dataKey="Despesas"
                            stroke={isDark ? '#ff4d8d' : '#f43f5e'}
                            strokeWidth={2.5}
                            fill="url(#neonAreaDes)"
                            dot={false}
                            activeDot={{ r: 5, fill: isDark ? '#ff4d8d' : '#f43f5e', strokeWidth: 0 }}
                            filter={isDark ? 'url(#neonLineGlow)' : undefined}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="relatorios-chart-empty">Sem dados mensais no período.</div>
                    )}
                  </div>
                </article>
              </div>
            </section>

            <section className="relatorios-charts__section" aria-labelledby="rel-month-heading">
              <h3 id="rel-month-heading" className="relatorios-charts__section-title">
                Mensal
              </h3>
              <div className="relatorios-charts__section-grid">
                <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card relatorios-chart-card--wide">
                  <div className="ref-panel__head">
                    <div>
                      <h2 className="ref-panel__title">Evolução mensal</h2>
                      <p className="ref-panel__subtitle">Receitas e despesas por mês</p>
                    </div>
                  </div>
                  <div className="relatorios-chart-card__body">
                    {chartDataPorMes.length > 0 ? (
                      <ResponsiveContainer width="100%" height={isMobile ? 240 : 300} debounce={50}>
                        <BarChart data={chartDataPorMes} margin={{ top: 12, right: 8, left: 0, bottom: 4 }} barGap={2} barCategoryGap="20%">
                          <defs>
                            <linearGradient id="relGradRecMes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={chart.barRecTop} stopOpacity={1} />
                              <stop offset="100%" stopColor={chart.barRecBot} stopOpacity={0.92} />
                            </linearGradient>
                            <linearGradient id="relGradDesMes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={chart.barDesTop} stopOpacity={1} />
                              <stop offset="100%" stopColor={chart.barDesBot} stopOpacity={0.9} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 8" stroke={chart.axis} strokeOpacity={0.18} vertical={false} />
                          <XAxis dataKey="name" stroke={chart.axis} fontSize={isMobile ? 10 : 11} tickMargin={8} tick={{ fill: chart.tickFill }} axisLine={false} tickLine={false} interval={0} angle={isMobile ? -35 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 56 : 32} />
                          <YAxis stroke={chart.axis} fontSize={isMobile ? 10 : 11} tickLine={false} axisLine={false} tick={{ fill: chart.tickFill }} tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`)} width={isMobile ? 56 : 64} />
                          <Tooltip
                            content={(props) => <RelatoriosTooltip {...props} formatCurrency={formatCurrency} />}
                            cursor={{ fill: chart.cursorFill }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: 12, color: chart.legend, fontSize: 12 }} />
                          <Bar dataKey="Receitas" fill="url(#relGradRecMes)" radius={isMobile ? [3, 3, 0, 0] : [6, 6, 0, 0]} maxBarSize={40} />
                          <Bar dataKey="Despesas" fill="url(#relGradDesMes)" radius={isMobile ? [3, 3, 0, 0] : [6, 6, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="relatorios-chart-empty">Sem dados mensais no período.</div>
                    )}
                  </div>
                </article>
              </div>
            </section>

            <section className="relatorios-charts__section" aria-labelledby="rel-saldo-acum-heading">
              <h3 id="rel-saldo-acum-heading" className="relatorios-charts__section-title">Saldo acumulado</h3>
              <div className="relatorios-charts__section-grid">
                <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card relatorios-chart-card--wide">
                  <div className="ref-panel__head">
                    <div>
                      <h2 className="ref-panel__title">Saldo acumulado</h2>
                      <p className="ref-panel__subtitle">Evolução do saldo somado ao longo do período</p>
                    </div>
                  </div>
                  <div className="relatorios-chart-card__body">
                    {chartDataSaldoAcumulado.length > 0 ? (
                      <ResponsiveContainer width="100%" height={isMobile ? 220 : 280} debounce={50}>
                        <AreaChart data={chartDataSaldoAcumulado} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                          <defs>
                            <linearGradient id="relGradSaldoAcum" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isDark ? '#e4bc6a' : '#c49535'} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={isDark ? '#e4bc6a' : '#c49535'} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 8" stroke={chart.axis} strokeOpacity={0.18} vertical={false} />
                          <XAxis dataKey="name" stroke={chart.axis} fontSize={isMobile ? 10 : 11} tickMargin={8} tick={{ fill: chart.tickFill }} axisLine={false} tickLine={false} interval={0} angle={isMobile ? -35 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 56 : 32} />
                          <YAxis stroke={chart.axis} fontSize={isMobile ? 10 : 11} tickLine={false} axisLine={false} tick={{ fill: chart.tickFill }} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`)} width={isMobile ? 56 : 64} />
                          <Tooltip content={(props) => <RelatoriosTooltip {...props} formatCurrency={formatCurrency} />} cursor={{ stroke: chart.cursorFill, strokeWidth: 1 }} />
                          <Area type="monotone" dataKey="Saldo" stroke={isDark ? '#e4bc6a' : '#c49535'} strokeWidth={2.5} fill="url(#relGradSaldoAcum)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="relatorios-chart-empty">Sem dados no período.</div>
                    )}
                  </div>
                </article>
              </div>
            </section>

            <div className="relatorios-charts__pair">
              <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card">
                <div className="ref-panel__head">
                  <div>
                    <h2 className="ref-panel__title">Despesas por categoria</h2>
                    <p className="ref-panel__subtitle">Distribuição das saídas</p>
                  </div>
                </div>
                <div className="relatorios-chart-card__body relatorios-chart-card__body--pie">
                  {chartDataPorCategoria.length > 0 ? (
                    <div className="relatorios-pie-layout">
                      <div className="relatorios-pie-layout__chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartDataPorCategoria}
                              cx="50%"
                              cy="50%"
                              innerRadius="40%"
                              outerRadius="74%"
                              paddingAngle={2}
                              dataKey="value"
                              nameKey="name"
                              stroke={chart.pieStroke}
                              strokeWidth={1}
                              onClick={(_, index) => drillCategoria(chartDataPorCategoria[index]?.name)}
                              style={{ cursor: 'pointer' }}
                            >
                              {chartDataPorCategoria.map((_, index) => (
                                <Cell key={`desp-${index}`} fill={chart.pieColorsDesp[index % chart.pieColorsDesp.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null
                                const p = payload[0]
                                const pct = formatPctBr(p.value, totalPieDesp)
                                return (
                                  <div className="relatorios-tooltip">
                                    <div className="relatorios-tooltip__label">{p.name}</div>
                                    <div className="relatorios-tooltip__row relatorios-tooltip__row--pie">
                                      <span className="relatorios-tooltip__val">{formatCurrency(p.value)}</span>
                                      <span className="relatorios-tooltip__pct">{pct}</span>
                                    </div>
                                  </div>
                                )
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <aside className="relatorios-pie-layout__legend" style={{ color: chart.legend }}>
                        <RelatorioPieLegendList
                          rows={chartDataPorCategoria}
                          colorAt={(i) => chart.pieColorsDesp[i % chart.pieColorsDesp.length]}
                          total={totalPieDesp}
                          formatCurrency={formatCurrency}
                        />
                      </aside>
                    </div>
                  ) : (
                    <div className="relatorios-chart-empty">Sem despesas no período.</div>
                  )}
                </div>
              </article>

              <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card">
                <div className="ref-panel__head">
                  <div>
                    <h2 className="ref-panel__title">Receitas por categoria</h2>
                    <p className="ref-panel__subtitle">Distribuição das entradas</p>
                  </div>
                </div>
                <div className="relatorios-chart-card__body relatorios-chart-card__body--pie">
                  {chartDataReceitasPorCategoria.length > 0 ? (
                    <div className="relatorios-pie-layout">
                      <div className="relatorios-pie-layout__chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartDataReceitasPorCategoria}
                              cx="50%"
                              cy="50%"
                              innerRadius="40%"
                              outerRadius="74%"
                              paddingAngle={2}
                              dataKey="value"
                              nameKey="name"
                              stroke={chart.pieStroke}
                              strokeWidth={1}
                              onClick={(_, index) => drillCategoria(chartDataReceitasPorCategoria[index]?.name)}
                              style={{ cursor: 'pointer' }}
                            >
                              {chartDataReceitasPorCategoria.map((_, index) => (
                                <Cell key={`rec-${index}`} fill={chart.pieColorsRec[index % chart.pieColorsRec.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null
                                const p = payload[0]
                                const pct = formatPctBr(p.value, totalPieRec)
                                return (
                                  <div className="relatorios-tooltip">
                                    <div className="relatorios-tooltip__label">{p.name}</div>
                                    <div className="relatorios-tooltip__row relatorios-tooltip__row--pie">
                                      <span className="relatorios-tooltip__val">{formatCurrency(p.value)}</span>
                                      <span className="relatorios-tooltip__pct">{pct}</span>
                                    </div>
                                  </div>
                                )
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <aside className="relatorios-pie-layout__legend" style={{ color: chart.legend }}>
                        <RelatorioPieLegendList
                          rows={chartDataReceitasPorCategoria}
                          colorAt={(i) => chart.pieColorsRec[i % chart.pieColorsRec.length]}
                          total={totalPieRec}
                          formatCurrency={formatCurrency}
                        />
                      </aside>
                    </div>
                  ) : (
                    <div className="relatorios-chart-empty">Sem receitas no período.</div>
                  )}
                </div>
              </article>
            </div>

            {orcadoVsReal.length > 0 && (
              <section className="relatorios-charts__section" aria-labelledby="rel-orcado-heading">
                <h3 id="rel-orcado-heading" className="relatorios-charts__section-title">Orçado vs Real</h3>
                <div className="relatorios-charts__section-grid">
                  <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card relatorios-chart-card--wide">
                    <div className="ref-panel__head">
                      <div>
                        <h2 className="ref-panel__title">Orçamento por categoria</h2>
                        <p className="ref-panel__subtitle">Gasto no período vs limite mensal definido</p>
                      </div>
                    </div>
                    <div className="relatorios-orcado">
                      {orcadoVsReal.map((r) => (
                        <div key={r.id} className={`relatorios-orcado__row${r.excedido ? ' relatorios-orcado__row--over' : ''}`}>
                          <div className="relatorios-orcado__top">
                            <span className="relatorios-orcado__cat" title={r.nome}>{r.nome}</span>
                            <span className={`relatorios-orcado__vals ${privacyMode ? 'privacy-blur' : ''}`}>
                              {formatCurrency(r.gasto)} <span className="relatorios-orcado__limite">/ {formatCurrency(r.limite)}</span>
                            </span>
                          </div>
                          <div className="relatorios-orcado__bar" aria-hidden="true">
                            <span className="relatorios-orcado__fill" style={{ width: `${r.excedido ? 100 : r.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </section>
            )}

            {top5Despesas.length > 0 && (
              <section className="relatorios-charts__section" aria-labelledby="rel-top5-heading">
                <h3 id="rel-top5-heading" className="relatorios-charts__section-title">Maiores despesas</h3>
                <div className="relatorios-charts__section-grid">
                  <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card relatorios-chart-card--wide">
                    <div className="ref-panel__head">
                      <div>
                        <h2 className="ref-panel__title">Top 5 despesas</h2>
                        <p className="ref-panel__subtitle">As maiores saídas do período</p>
                      </div>
                    </div>
                    <ol className="relatorios-top5">
                      {top5Despesas.map((t, i) => (
                        <li key={t.id} className="relatorios-top5__item">
                          <span className="relatorios-top5__rank">{i + 1}</span>
                          <span className="relatorios-top5__info">
                            <span className="relatorios-top5__desc" title={t.desc}>{t.desc}</span>
                            <span className="relatorios-top5__cat">
                              {t.cat}{t.data ? ` · ${new Date(t.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}
                            </span>
                          </span>
                          <span className={`relatorios-top5__val ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(t.valor)}</span>
                        </li>
                      ))}
                    </ol>
                  </article>
                </div>
              </section>
            )}

            <section className="relatorios-charts__section" aria-labelledby="rel-recorrentes-heading">
              <h3 id="rel-recorrentes-heading" className="relatorios-charts__section-title">
                Recorrentes
              </h3>
              <div className="relatorios-charts__section-grid">
                <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card relatorios-chart-card--wide">
                  <div className="ref-panel__head">
                    <div>
                      <h2 className="ref-panel__title">Recorrentes</h2>
                      <p className="ref-panel__subtitle">
                        Despesas fixas e parceladas
                        {totalComprasRecorrentesPeriodo > 0 ? (
                          <>
                            {' '}
                            · total no período:{' '}
                            <span className={privacyMode ? 'privacy-blur' : ''}>
                              {formatCurrency(totalComprasRecorrentesPeriodo)}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="relatorios-chart-card__body">
                    {totalComprasRecorrentesPeriodo > 0 ? (
                      <ResponsiveContainer width="100%" height={isMobile ? 240 : 300} debounce={50}>
                        <BarChart
                          data={chartDataComprasRecorrentesMes}
                          margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
                          barGap={2}
                          barCategoryGap="22%"
                        >
                          <defs>
                            <linearGradient id="relGradRecurrMes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={chart.barRecurrTop} stopOpacity={1} />
                              <stop offset="100%" stopColor={chart.barRecurrBot} stopOpacity={0.92} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 8" stroke={chart.axis} strokeOpacity={0.18} vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke={chart.axis}
                            fontSize={isMobile ? 10 : 11}
                            tickMargin={8}
                            tick={{ fill: chart.tickFill }}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                            angle={isMobile ? -35 : 0}
                            textAnchor={isMobile ? 'end' : 'middle'}
                            height={isMobile ? 56 : 32}
                          />
                          <YAxis
                            stroke={chart.axis}
                            fontSize={isMobile ? 10 : 11}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: chart.tickFill }}
                            tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`)}
                            width={isMobile ? 56 : 64}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const v = payload[0]?.value
                              return (
                                <div className="relatorios-tooltip">
                                  <div className="relatorios-tooltip__label">{label}</div>
                                  <div className="relatorios-tooltip__row">
                                    <span className="relatorios-tooltip__dot" style={{ background: chart.barRecurrTop }} />
                                    <span className="relatorios-tooltip__name">Despesas recorrentes</span>
                                    <span className="relatorios-tooltip__val">{formatCurrency(v)}</span>
                                  </div>
                                </div>
                              )
                            }}
                            cursor={{ fill: chart.cursorFill }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: 12, color: chart.legend, fontSize: 12 }} />
                          <Bar
                            dataKey="total"
                            name="Despesas recorrentes"
                            fill="url(#relGradRecurrMes)"
                            radius={isMobile ? [3, 3, 0, 0] : [6, 6, 0, 0]}
                            maxBarSize={44}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="relatorios-chart-empty">
                        Nenhuma recorrência no período.
                      </div>
                    )}
                  </div>
                </article>
              </div>
            </section>
          </div>
  )
}

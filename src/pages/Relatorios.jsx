import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { fetchWithRetry } from '../lib/fetchWithRetry'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { useRelatorioAggregates } from '../hooks/useRelatorioAggregates'
import { useMatchMaxWidth } from '../hooks/useMatchMaxWidth'
import { readHorizonteUserProfile, horizonteUserProfileTemId } from '../lib/horizonteSession'
import { getRelatorioChartPalette } from '../lib/relatorioChartTokens'
import { downloadRelatorioCsv } from '../lib/relatorioExportCsv'
import './dashboard.css'
import {
  BarChart,
  Bar,
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

function formatPctBr(value, total) {
  if (!total || total <= 0) return '0%'
  const pct = (Number(value) / total) * 100
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`
}

/** Legenda ao lado do gráfico (fora do Recharts — layout responsivo estável) */
function RelatorioPieLegendList({ rows, colorAt, total, formatCurrency }) {
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

const SkeletonKpi = () => (
  <div className="ref-kpi-card ref-kpi-card--skeleton" aria-hidden>
    <div className="skeleton skeleton-pulse ref-kpi-skel-icon" />
    <div className="ref-kpi-skel-body">
      <span className="skeleton skeleton-pulse ref-kpi-skel-line ref-kpi-skel-line--label" />
      <span className="skeleton skeleton-pulse ref-kpi-skel-line ref-kpi-skel-line--value" />
    </div>
  </div>
)

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

/** Mesmo grid dos gráficos reais: títulos fixos + área pulsante (evita “cards genéricos” + tabela falsa). */
function RelatoriosChartsLoadingShell() {
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
    </div>
  )
}

function RelatoriosTooltip({ active, payload, label, formatCurrency }) {
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

export default function Relatorios() {
  const { privacyMode } = useTheme()
  const chartMono = false
  const [usuario] = useState(() => readHorizonteUserProfile())

  // States
  const [menuAberto, setMenuAberto] = useState(false)
  const [transacoes, setTransacoes] = useState([])
  const [categorias, setCategorias] = useState([])
  const firstFetchDoneRef = useRef(false)
  const [loading, setLoading] = useState(() => horizonteUserProfileTemId(readHorizonteUserProfile()))
  const [refreshing, setRefreshing] = useState(false)
  const [pdfExportLoading, setPdfExportLoading] = useState(false)
  const isMobile = useMatchMaxWidth(768)

  // Filters State (default para o mês atual)
  const [filters, setFilters] = useState(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
    return {
      dataInicio: firstDay,
      dataFim: lastDay,
      categoria_id: ''
    }
  })
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/categorias'), {
        headers: { 'x-user-id': usuario.id }
      })
      if (res.ok) {
        const data = await res.json()
        setCategorias(data || [])
      }
    } catch (err) { console.error(err) }
  }, [usuario.id])

  // Fetch Transacoes
  const fetchTransacoes = useCallback(async () => {
    const isInitial = !firstFetchDoneRef.current
    if (isInitial) setLoading(true)
    else setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio)
      if (filters.dataFim) params.append('dataFim', filters.dataFim)
      if (filters.categoria_id) params.append('categoria_id', filters.categoria_id)
      params.append('limit', '500')
      params.append('status', 'EFETIVADA') // Para relatórios, focamos nas efetivadas normalmente

      const res = await fetchWithRetry(apiUrl(`/api/transacoes?${params.toString()}`), {
        headers: { 'x-user-id': String(usuario.id).trim() },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setTransacoes(data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstFetchDoneRef.current = true
    }
  }, [usuario.id, filters])

  useEffect(() => {
    firstFetchDoneRef.current = false
  }, [usuario.id])

  useEffect(() => {
    if (usuario.id) {
      fetchCategorias()
      fetchTransacoes()
    }
  }, [usuario.id, fetchCategorias, fetchTransacoes])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const clearRelatorioFilters = useCallback(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
    setFilters({ dataInicio: firstDay, dataFim: lastDay, categoria_id: '' })
  }, [])

  const {
    summary,
    chartDataPorMes,
    chartDataComprasRecorrentesMes,
    totalComprasRecorrentesPeriodo,
    chartDataPorCategoria,
    chartDataReceitasPorCategoria,
  } = useRelatorioAggregates(transacoes)

  const totalPieDesp = useMemo(
    () => chartDataPorCategoria.reduce((s, x) => s + (Number(x.value) || 0), 0),
    [chartDataPorCategoria]
  )
  const totalPieRec = useMemo(
    () => chartDataReceitasPorCategoria.reduce((s, x) => s + (Number(x.value) || 0), 0),
    [chartDataReceitasPorCategoria]
  )

  const formatCurrency = formatCurrencyBRL

  const exportToCSV = () => downloadRelatorioCsv(transacoes, filters)

  const exportToPDF = async () => {
    if (transacoes.length === 0) return

    setPdfExportLoading(true)
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const autoTable = autoTableMod.default

      const doc = new jsPDF()

      // Título do Relatório
      doc.setFontSize(18)
      doc.text('Relatório Analítico de Transações', 14, 22)
      doc.setFontSize(11)
      doc.setTextColor(100)
      doc.text(`Período: ${new Date(filters.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(filters.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, 30)

      // Resumo Financeiro
      doc.setFontSize(12)
      doc.setTextColor(0)
      doc.text(`Total de Receitas: ${formatCurrency(summary.receitas)}`, 14, 40)
      doc.text(`Total de Despesas: ${formatCurrency(summary.despesas)}`, 14, 48)
      doc.text(`Saldo Líquido: ${formatCurrency(summary.saldo)}`, 14, 56)

      // Tabela
      const tableColumn = ['Data', 'Tipo', 'Categoria', 'Valor', 'Status']
      const tableRows = []

      transacoes.forEach((t) => {
        const dataStr = new Date(t.data_transacao).toLocaleDateString('pt-BR')
        const tipo = t.tipo
        const cat = t.categorias?.nome || 'Sem categoria'
        const valor = formatCurrency(t.valor)
        const status = t.status || ''

        tableRows.push([dataStr, tipo, cat, valor, status])
      })

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 65,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [44, 62, 80] },
      })

      doc.save(`relatorio_${filters.dataInicio}_a_${filters.dataFim}.pdf`)
    } finally {
      setPdfExportLoading(false)
    }
  }

  const chart = getRelatorioChartPalette(chartMono)

  const saldoPositivo = summary.saldo >= 0

  return (
    <div
      className="dashboard-container page-relatorios ref-dashboard app-horizon-shell"
      style={{ '--rel-tooltip-bg': chart.tooltipBg }}
    >
      <div className="app-horizon-inner">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner dashboard-hub">
        <section className="dashboard-hub__hero" aria-label="Relatórios e exportação">
          <div className="dashboard-hub__hero-row">
            <MobileMenuButton onClick={() => setMenuAberto(true)} />
            <div className="dashboard-hub__hero-text">
              <h1 className="dashboard-hub__title">Relatórios</h1>
            </div>
            <div className="dashboard-hub__hero-actions relatorios-header-export" role="toolbar" aria-label="Exportar relatório">
              <button
                type="button"
                className="dashboard-hub__btn dashboard-hub__btn--secondary relatorios-btn-export"
                onClick={exportToCSV}
                disabled={transacoes.length === 0}
                title="Exportar CSV"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                <span className="desktop-only">CSV</span>
              </button>
              <button
                type="button"
                className="dashboard-hub__btn dashboard-hub__btn--primary relatorios-btn-export"
                onClick={exportToPDF}
                disabled={transacoes.length === 0 || pdfExportLoading}
                title={pdfExportLoading ? 'Gerando PDF…' : 'Baixar PDF'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <span className="desktop-only">{pdfExportLoading ? '…' : 'PDF'}</span>
              </button>
            </div>
          </div>
        </section>

        <RefDashboardScroll>
        <article
          className={`ref-panel page-relatorios-ref-filters ${filtrosAbertos ? '' : 'page-relatorios-ref-filters--collapsed'}`}
          aria-label="Filtros"
        >
          <div className="ref-panel__head page-relatorios-filters-head">
            <button
              type="button"
              className="page-relatorios-filters-toggle"
              id="relatorio-filtros-trigger"
              aria-expanded={filtrosAbertos}
              aria-controls="relatorio-filtros-fields"
              onClick={() => setFiltrosAbertos((open) => !open)}
            >
              <span className="page-relatorios-filters-toggle__lead">
                <span className="ref-panel__title" role="heading" aria-level={2}>
                  Filtros
                </span>
              </span>
              <svg
                className={`page-relatorios-filters-toggle__chevron ${filtrosAbertos ? 'page-relatorios-filters-toggle__chevron--open' : ''}`}
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
            <button type="button" className="ref-panel__link ref-panel__link--button" onClick={clearRelatorioFilters}>
              Limpar filtros
            </button>
          </div>
          <div
            id="relatorio-filtros-fields"
            className="page-relatorios-filters-body"
            role="region"
            aria-labelledby="relatorio-filtros-trigger"
            hidden={!filtrosAbertos}
          >
            <div className="relatorios-filter-grid page-relatorios-filter-grid">
              <div className="filter-group">
                <label htmlFor="rel-ini">Data início</label>
                <input id="rel-ini" type="date" name="dataInicio" className="filter-input" value={filters.dataInicio} onChange={handleFilterChange} />
              </div>
              <div className="filter-group">
                <label htmlFor="rel-fim">Data fim</label>
                <input id="rel-fim" type="date" name="dataFim" className="filter-input" value={filters.dataFim} onChange={handleFilterChange} />
              </div>
              <div className="filter-group relatorios-filter-grid__wide">
                <label htmlFor="rel-cat">Categoria</label>
                <select id="rel-cat" name="categoria_id" className="filter-input" value={filters.categoria_id} onChange={handleFilterChange}>
                  <option value="">Todas</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </article>

        <section
          className={`ref-kpi-row${refreshing ? ' relatorios-kpi-row--refreshing' : ''}`}
          aria-label="Resumo do período"
          aria-busy={loading || refreshing}
        >
          {loading ? (
            <>
              <SkeletonKpi />
              <SkeletonKpi />
              <SkeletonKpi />
            </>
          ) : (
            <>
              <article className="ref-kpi-card ref-kpi-card--income">
                <div className="ref-kpi-card__icon" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5" />
                    <path d="m5 12 7-7 7 7" />
                  </svg>
                </div>
                <div className="ref-kpi-card__body">
                  <p className="ref-kpi-card__label">Total de receitas</p>
                  <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(summary.receitas)}</p>
                </div>
              </article>
              <article className="ref-kpi-card ref-kpi-card--expense">
                <div className="ref-kpi-card__icon" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" />
                    <path d="m19 12-7 7-7-7" />
                  </svg>
                </div>
                <div className="ref-kpi-card__body">
                  <p className="ref-kpi-card__label">Total de despesas</p>
                  <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>− {formatCurrency(summary.despesas)}</p>
                </div>
              </article>
              <article className="ref-kpi-card ref-kpi-card--balance ref-kpi-card--hero">
                <div className="ref-kpi-card__icon" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <path d="M2 10h20" />
                    <circle cx="16" cy="13" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <div className="ref-kpi-card__body">
                  <p className="ref-kpi-card__label">Saldo no período</p>
                  <p
                    className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''} ${saldoPositivo ? 'relatorios-kpi-saldo--pos' : 'relatorios-kpi-saldo--neg'}`}
                  >
                    {formatCurrency(summary.saldo)}
                  </p>
                </div>
              </article>
            </>
          )}
        </section>

        {loading ? (
          <RelatoriosChartsLoadingShell />
        ) : transacoes.length === 0 ? (
          <p className="relatorios-empty-msg">Nenhuma transação efetivada neste período para compor o relatório.</p>
        ) : (
          <div className={`relatorios-charts${refreshing ? ' relatorios-charts--refreshing' : ''}`} aria-busy={refreshing}>
            <section className="relatorios-charts__section" aria-labelledby="rel-month-heading">
              <h3 id="rel-month-heading" className="relatorios-charts__section-title">
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

                <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card relatorios-chart-card--wide">
                  <div className="ref-panel__head">
                    <div>
                      <h2 className="ref-panel__title">Compras recorrentes por mês</h2>
                      <p className="ref-panel__subtitle">
                        Soma das despesas marcadas como recorrentes (regra mensal ou parcelamento) por mês
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
                        Nenhuma despesa recorrente no período (regra mensal ou parcelas).
                      </div>
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
                    <p className="ref-panel__subtitle">Distribuição do que saiu no período</p>
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
                    <p className="ref-panel__subtitle">De onde entrou dinheiro no período</p>
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
          </div>
        )}
        </RefDashboardScroll>
        </div>
      </main>
      </div>
    </div>
  )
}

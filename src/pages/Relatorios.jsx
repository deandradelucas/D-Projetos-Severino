import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import GlobalSkeleton from '../components/GlobalSkeleton'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { fetchWithRetry } from '../lib/fetchWithRetry'
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
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts'
const COLORS_DESP = ['#38bdf8', '#34d399', '#fbbf24', '#fb923c', '#a78bfa', '#f472b6', '#94a3b8', '#64748b']
const COLORS_REC = ['#4ade80', '#22d3ee', '#fcd34d', '#a78bfa', '#f472b6', '#94a3b8', '#64748b']
const COLORS_PIE_MONO_DESP = ['#3a3a3a', '#4a4a4a', '#5a5a5a', '#6b6b6b', '#7c7c7c', '#8e8e8e', '#a1a1a1', '#b5b5b5']
const COLORS_PIE_MONO_REC = ['#e5e5e5', '#d0d0d0', '#bbbbbb', '#a6a6a6', '#919191', '#7d7d7d', '#696969', '#565656']

const SkeletonKpi = () => (
  <div className="ref-kpi-card ref-kpi-card--skeleton" aria-hidden>
    <div className="skeleton skeleton-pulse ref-kpi-skel-icon" />
    <div className="ref-kpi-skel-body">
      <span className="skeleton skeleton-pulse ref-kpi-skel-line ref-kpi-skel-line--label" />
      <span className="skeleton skeleton-pulse ref-kpi-skel-line ref-kpi-skel-line--value" />
    </div>
  </div>
)

function transacaoDiaKey(dataTransacao) {
  if (dataTransacao == null) return ''
  const s = String(dataTransacao).trim()
  if (!s) return ''
  const head = s.includes('T') ? s.split('T')[0] : s.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ''
}

/** YYYY-MM a partir da data da transação */
function transacaoMesKey(dataTransacao) {
  const d = transacaoDiaKey(dataTransacao)
  if (!d) return ''
  return d.slice(0, 7)
}

function labelMesBr(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  if (!y || !m) return String(ym)
  return new Date(y, m - 1, 15).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function tipoNormalizado(tipo) {
  return String(tipo || '').trim().toUpperCase()
}

/** Despesa ligada a regra mensal (dia 1) ou parcelamento — mesmo critério do ícone nas listas */
function isDespesaRecorrente(t) {
  return (
    tipoNormalizado(t.tipo) === 'DESPESA' &&
    (Boolean(t.recorrencia_mensal_id) || Boolean(t.recorrente_index))
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
  const { privacyMode, theme } = useTheme()
  const chartMono = theme === 'dark' || theme === 'glass'
  const [usuario] = useState(() => {
    const saved = localStorage.getItem('horizonte_user')
    if (saved) {
      try {
        return JSON.parse(saved) || { nome: 'Usuário', id: '' }
      } catch (e) { console.error(e) }
    }
    return { nome: 'Usuário', id: '' }
  })

  // States
  const [menuAberto, setMenuAberto] = useState(false)
  const [transacoes, setTransacoes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(false)
  const [pdfExportLoading, setPdfExportLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    setLoading(true)
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
    }
  }, [usuario.id, filters])

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

  // Memoized aggregations
  const {
    summary,
    chartDataPorMes,
    chartDataComprasRecorrentesMes,
    totalComprasRecorrentesPeriodo,
    chartDataPorCategoria,
    chartDataReceitasPorCategoria,
    chartDataSaldoCumMes,
  } = useMemo(() => {
    let receitas = 0
    let despesas = 0

    const mesMap = {}
    const recorrentesMesMap = {}
    const catMap = {}
    const recCatMap = {}

    transacoes.forEach((t) => {
      const dRaw = transacaoDiaKey(t.data_transacao)
      if (!dRaw) return
      const val = Number(t.valor)
      const valorNum = Number.isFinite(val) ? val : parseFloat(String(t.valor).replace(',', '.')) || 0
      const tipo = tipoNormalizado(t.tipo)

      const mRaw = transacaoMesKey(t.data_transacao)
      if (mRaw) {
        if (!mesMap[mRaw]) {
          mesMap[mRaw] = { Receitas: 0, Despesas: 0 }
        }
        if (tipo === 'RECEITA') {
          mesMap[mRaw].Receitas += valorNum
        } else {
          mesMap[mRaw].Despesas += valorNum
        }
        if (isDespesaRecorrente(t)) {
          recorrentesMesMap[mRaw] = (recorrentesMesMap[mRaw] || 0) + valorNum
        }
      }

      if (tipo === 'RECEITA') {
        receitas += valorNum
        const cn = t.categorias?.nome || 'Sem categoria'
        recCatMap[cn] = (recCatMap[cn] || 0) + valorNum
      } else {
        despesas += valorNum
        const catName = t.categorias?.nome || 'Sem categoria'
        catMap[catName] = (catMap[catName] || 0) + valorNum
      }
    })

    const sortedMesKeys = Object.keys(mesMap).sort()
    const chartDataPorMes = sortedMesKeys.map((k) => {
      const row = mesMap[k]
      return {
        name: labelMesBr(k),
        Receitas: row.Receitas,
        Despesas: row.Despesas,
      }
    })

    const chartDataComprasRecorrentesMes = sortedMesKeys.map((k) => ({
      name: labelMesBr(k),
      total: recorrentesMesMap[k] || 0,
    }))
    const totalComprasRecorrentesPeriodo = sortedMesKeys.reduce(
      (acc, k) => acc + (recorrentesMesMap[k] || 0),
      0
    )

    let runMes = 0
    const chartDataSaldoCumMes = sortedMesKeys.map((k) => {
      const row = mesMap[k]
      const net = row.Receitas - row.Despesas
      runMes += net
      return {
        name: labelMesBr(k),
        saldo: runMes,
        liquidoMes: net,
      }
    })

    const chartDataPorCategoria = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const chartDataReceitasPorCategoria = Object.entries(recCatMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    return {
      summary: { receitas, despesas, saldo: receitas - despesas },
      chartDataPorMes,
      chartDataComprasRecorrentesMes,
      totalComprasRecorrentesPeriodo,
      chartDataPorCategoria,
      chartDataReceitasPorCategoria,
      chartDataSaldoCumMes,
    }
  }, [transacoes])

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const exportToCSV = () => {
    if (transacoes.length === 0) return

    // Cabeçalho
    let csvData = ['Data,Tipo,Categoria,Subcategoria,Valor,Status,Descrição']

    // Linhas
    transacoes.forEach(t => {
      const dataStr = new Date(t.data_transacao).toLocaleDateString('pt-BR')
      const cat = t.categorias?.nome || ''
      const sub = t.subcategorias?.nome || ''
      const descricao = t.descricao ? t.descricao.replace(/,/g, '') : ''
      csvData.push(`${dataStr},${t.tipo},${cat},${sub},${t.valor},${t.status},${descricao}`)
    })

    const blob = new Blob([csvData.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `relatorio_${filters.dataInicio}_a_${filters.dataFim}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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

  /* Cards de gráfico: eixos legíveis; off-white = só cinzas */
  const chartAxis = chartMono ? '#525252' : '#94a3b8'
  const chartTickFill = chartMono ? '#a3a3a3' : '#475569'
  const legendColor = chartMono ? '#d4d4d4' : '#334155'
  const tooltipBg = chartMono ? '#0a0a0a' : '#ffffff'
  const pieColorsDesp = chartMono ? COLORS_PIE_MONO_DESP : COLORS_DESP
  const pieColorsRec = chartMono ? COLORS_PIE_MONO_REC : COLORS_REC
  const pieStroke = chartMono ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)'
  const chartCursorFill = chartMono ? 'rgba(255,255,255,0.05)' : 'rgba(15, 23, 42, 0.06)'
  const refLineStroke = chartMono ? 'rgba(255,255,255,0.28)' : 'rgba(100, 116, 139, 0.45)'
  const barRecTop = chartMono ? '#d4d4d4' : '#4ade80'
  const barRecBot = chartMono ? '#525252' : '#059669'
  const barDesTop = chartMono ? '#9ca3af' : '#fb7185'
  const barDesBot = chartMono ? '#404040' : '#dc2626'
  const barRecurrTop = chartMono ? '#a3a3a3' : '#2dd4bf'
  const barRecurrBot = chartMono ? '#404040' : '#0f766e'
  const saldoStop0 = chartMono ? '#d4d4d4' : '#a78bfa'
  const saldoStop0Op = chartMono ? 0.48 : 0.55
  const saldoStop1 = chartMono ? '#525252' : '#6366f1'
  const saldoStop1Op = chartMono ? 0.1 : 0.05
  const saldoLine = chartMono ? '#c4c4c4' : '#a78bfa'
  const saldoDot = chartMono ? '#dedede' : '#c4b5fd'

  const saldoPositivo = summary.saldo >= 0

  return (
    <div
      className="dashboard-container page-relatorios app-horizon-shell"
      style={{ '--rel-tooltip-bg': tooltipBg }}
    >
      <div className="app-horizon-inner">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner">
        <header className="ref-dashboard-header">
          <MobileMenuButton onClick={() => setMenuAberto(true)} />
          <div className="ref-dashboard-header__lead">
            <h1 className="ref-dashboard-greeting">
              <span className="ref-dashboard-greeting__name">Relatórios analíticos</span>
            </h1>
            <p className="ref-panel__subtitle page-relatorios-header-sub">
              Receitas, despesas e composição por categoria no período
            </p>
          </div>
          <div className="ref-dashboard-header__actions relatorios-header-export">
            <button type="button" className="btn-secondary relatorios-btn-export" onClick={exportToCSV} disabled={transacoes.length === 0} title="Exportar CSV">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              <span className="desktop-only">CSV</span>
            </button>
            <button
              type="button"
              className="btn-primary btn-primary-dashboard relatorios-btn-export"
              onClick={exportToPDF}
              disabled={transacoes.length === 0 || pdfExportLoading}
              title={pdfExportLoading ? 'Gerando PDF…' : 'Baixar PDF'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span className="desktop-only">{pdfExportLoading ? '…' : 'PDF'}</span>
            </button>
          </div>
        </header>

        <article className="ref-panel page-relatorios-ref-filters" aria-label="Período e categoria">
          <div className="ref-panel__head">
            <div>
              <h2 className="ref-panel__title">Filtros do relatório</h2>
              <p className="ref-panel__subtitle">Período e categoria · apenas transações efetivadas</p>
            </div>
          </div>
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
        </article>

        <section className="ref-kpi-row" aria-label="Resumo do período" aria-busy={loading}>
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
                  <p className="ref-kpi-card__label">Saldo líquido (período)</p>
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
          <div className="ref-bottom-grid ref-bottom-grid--single page-relatorios-loading-shell">
            <article className="ref-panel page-relatorios-loading-panel">
              <GlobalSkeleton variant="cards" />
            </article>
            <article className="ref-panel page-relatorios-loading-panel">
              <GlobalSkeleton variant="table" rows={6} />
            </article>
          </div>
        ) : transacoes.length === 0 ? (
          <p className="relatorios-empty-msg">Nenhuma transação efetivada neste período para compor o relatório.</p>
        ) : (
          <div className="relatorios-charts">
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
                              <stop offset="0%" stopColor={barRecTop} stopOpacity={1} />
                              <stop offset="100%" stopColor={barRecBot} stopOpacity={0.92} />
                            </linearGradient>
                            <linearGradient id="relGradDesMes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={barDesTop} stopOpacity={1} />
                              <stop offset="100%" stopColor={barDesBot} stopOpacity={0.9} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 8" stroke={chartAxis} strokeOpacity={0.18} vertical={false} />
                          <XAxis dataKey="name" stroke={chartAxis} fontSize={isMobile ? 10 : 11} tickMargin={8} tick={{ fill: chartTickFill }} axisLine={false} tickLine={false} interval={0} angle={isMobile ? -35 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 56 : 32} />
                          <YAxis stroke={chartAxis} fontSize={isMobile ? 10 : 11} tickLine={false} axisLine={false} tick={{ fill: chartTickFill }} tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`)} width={isMobile ? 56 : 64} />
                          <Tooltip
                            content={(props) => <RelatoriosTooltip {...props} formatCurrency={formatCurrency} />}
                            cursor={{ fill: chartCursorFill }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: 12, color: legendColor, fontSize: 12 }} />
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
                              <stop offset="0%" stopColor={barRecurrTop} stopOpacity={1} />
                              <stop offset="100%" stopColor={barRecurrBot} stopOpacity={0.92} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 8" stroke={chartAxis} strokeOpacity={0.18} vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke={chartAxis}
                            fontSize={isMobile ? 10 : 11}
                            tickMargin={8}
                            tick={{ fill: chartTickFill }}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                            angle={isMobile ? -35 : 0}
                            textAnchor={isMobile ? 'end' : 'middle'}
                            height={isMobile ? 56 : 32}
                          />
                          <YAxis
                            stroke={chartAxis}
                            fontSize={isMobile ? 10 : 11}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: chartTickFill }}
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
                                    <span className="relatorios-tooltip__dot" style={{ background: barRecurrTop }} />
                                    <span className="relatorios-tooltip__name">Despesas recorrentes</span>
                                    <span className="relatorios-tooltip__val">{formatCurrency(v)}</span>
                                  </div>
                                </div>
                              )
                            }}
                            cursor={{ fill: chartCursorFill }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: 12, color: legendColor, fontSize: 12 }} />
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

                <article className="ref-panel page-relatorios-chart-panel relatorios-chart-card relatorios-chart-card--wide">
                  <div className="ref-panel__head">
                    <div>
                      <h2 className="ref-panel__title">Saldo acumulado (mensal)</h2>
                      <p className="ref-panel__subtitle">Resultado líquido mês a mês no período (referência em zero)</p>
                    </div>
                  </div>
                  <div className="relatorios-chart-card__body relatorios-chart-card__body--area">
                    {chartDataSaldoCumMes.length > 0 ? (
                      <ResponsiveContainer width="100%" height={isMobile ? 240 : 300} debounce={50}>
                        <AreaChart data={chartDataSaldoCumMes} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                          <defs>
                            <linearGradient id="relGradSaldoMes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={saldoStop0} stopOpacity={saldoStop0Op} />
                              <stop offset="100%" stopColor={saldoStop1} stopOpacity={saldoStop1Op} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 8" stroke={chartAxis} strokeOpacity={0.18} vertical={false} />
                          <XAxis dataKey="name" stroke={chartAxis} fontSize={isMobile ? 10 : 11} tickMargin={8} tick={{ fill: chartTickFill }} axisLine={false} tickLine={false} interval={0} angle={isMobile ? -35 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 56 : 32} />
                          <YAxis stroke={chartAxis} fontSize={isMobile ? 10 : 11} tickLine={false} axisLine={false} tick={{ fill: chartTickFill }} tickFormatter={(v) => formatCurrency(v)} width={isMobile ? 68 : 72} />
                          <ReferenceLine y={0} stroke={refLineStroke} strokeDasharray="4 4" />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const row = payload[0]?.payload
                              return (
                                <div className="relatorios-tooltip">
                                  <div className="relatorios-tooltip__label">{label}</div>
                                  <div className="relatorios-tooltip__row">
                                    <span className="relatorios-tooltip__name">Acumulado</span>
                                    <span className="relatorios-tooltip__val">{formatCurrency(row?.saldo)}</span>
                                  </div>
                                  <div className="relatorios-tooltip__row relatorios-tooltip__row--muted">
                                    <span className="relatorios-tooltip__name">No mês</span>
                                    <span className="relatorios-tooltip__val">{formatCurrency(row?.liquidoMes)}</span>
                                  </div>
                                </div>
                              )
                            }}
                          />
                          <Area type="monotone" dataKey="saldo" stroke={saldoLine} strokeWidth={2.5} fill="url(#relGradSaldoMes)" dot={{ r: 3, fill: saldoDot, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="relatorios-chart-empty">Sem dados mensais no período.</div>
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
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartDataPorCategoria}
                          cx="50%"
                          cy="50%"
                          innerRadius={isMobile ? 52 : 68}
                          outerRadius={isMobile ? 80 : 102}
                          paddingAngle={3}
                          dataKey="value"
                          stroke={pieStroke}
                          strokeWidth={1}
                        >
                          {chartDataPorCategoria.map((_, index) => (
                            <Cell key={`desp-${index}`} fill={pieColorsDesp[index % pieColorsDesp.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const p = payload[0]
                            return (
                              <div className="relatorios-tooltip">
                                <div className="relatorios-tooltip__label">{p.name}</div>
                                <div className="relatorios-tooltip__row">
                                  <span className="relatorios-tooltip__val">{formatCurrency(p.value)}</span>
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          wrapperStyle={{ fontSize: 12, color: legendColor, paddingLeft: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
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
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartDataReceitasPorCategoria}
                          cx="50%"
                          cy="50%"
                          innerRadius={isMobile ? 52 : 68}
                          outerRadius={isMobile ? 80 : 102}
                          paddingAngle={3}
                          dataKey="value"
                          stroke={pieStroke}
                          strokeWidth={1}
                        >
                          {chartDataReceitasPorCategoria.map((_, index) => (
                            <Cell key={`rec-${index}`} fill={pieColorsRec[index % pieColorsRec.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const p = payload[0]
                            return (
                              <div className="relatorios-tooltip">
                                <div className="relatorios-tooltip__label">{p.name}</div>
                                <div className="relatorios-tooltip__row">
                                  <span className="relatorios-tooltip__val">{formatCurrency(p.value)}</span>
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          wrapperStyle={{ fontSize: 12, color: legendColor, paddingLeft: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="relatorios-chart-empty">Sem receitas no período.</div>
                  )}
                </div>
              </article>
            </div>
          </div>
        )}
        </div>
      </main>
      </div>
    </div>
  )
}

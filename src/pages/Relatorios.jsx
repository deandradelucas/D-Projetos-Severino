import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import { useTheme } from '../context/ThemeContext'
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
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COLORS_DESP = ['#38bdf8', '#34d399', '#fbbf24', '#fb923c', '#a78bfa', '#f472b6', '#94a3b8', '#64748b']
const COLORS_REC = ['#4ade80', '#22d3ee', '#fcd34d', '#a78bfa', '#f472b6', '#94a3b8', '#64748b']

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
  const { theme, privacyMode } = useTheme()
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
      const res = await fetch('/api/categorias', {
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

      const res = await fetch(`/api/transacoes?${params.toString()}`, {
        headers: { 'x-user-id': usuario.id }
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
    chartDataPorData,
    chartDataPorCategoria,
    chartDataReceitasPorCategoria,
    chartDataSaldoCum,
  } = useMemo(() => {
    let receitas = 0
    let despesas = 0

    const dataMap = {}
    const catMap = {}
    const recCatMap = {}

    transacoes.forEach((t) => {
      const val = parseFloat(t.valor) || 0
      const dRaw = t.data_transacao.split('T')[0]

      if (!dataMap[dRaw]) {
        dataMap[dRaw] = { raw: dRaw, Receitas: 0, Despesas: 0 }
      }

      if (t.tipo === 'RECEITA') {
        receitas += val
        dataMap[dRaw].Receitas += val
        const cn = t.categorias?.nome || 'Sem categoria'
        recCatMap[cn] = (recCatMap[cn] || 0) + val
      } else {
        despesas += val
        dataMap[dRaw].Despesas += val
        const catName = t.categorias?.nome || 'Sem categoria'
        catMap[catName] = (catMap[catName] || 0) + val
      }
    })

    const sortedKeys = Object.keys(dataMap).sort()

    const chartDataPorData = sortedKeys.map((k) => {
      const row = dataMap[k]
      return {
        name: new Date(k).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        Receitas: row.Receitas,
        Despesas: row.Despesas,
      }
    })

    let run = 0
    const chartDataSaldoCum = sortedKeys.map((k) => {
      const row = dataMap[k]
      const net = row.Receitas - row.Despesas
      run += net
      return {
        name: new Date(k).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        saldo: run,
        liquidoDia: net,
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
      chartDataPorData,
      chartDataPorCategoria,
      chartDataReceitasPorCategoria,
      chartDataSaldoCum,
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

  const exportToPDF = () => {
    if (transacoes.length === 0) return

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
    const tableColumn = ["Data", "Tipo", "Categoria", "Valor", "Status"]
    const tableRows = []

    transacoes.forEach(t => {
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
      headStyles: { fillColor: [44, 62, 80] }
    })

    doc.save(`relatorio_${filters.dataInicio}_a_${filters.dataFim}.pdf`)
  }

  // Cores de acordo com o tema e acessibilidade
  const axisColor = theme === 'light' ? '#333333' : '#e0e0e0'
  const tooltipBg = theme === 'light' ? '#ffffff' : '#1e1e2d'

  const saldoPositivo = summary.saldo >= 0

  return (
    <div
      className="dashboard-container page-relatorios"
      style={{ '--rel-tooltip-bg': tooltipBg }}
    >
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10">
        <header className="top-header relatorios-page-header">
          <div className="relatorios-page-header__titles">
            <button type="button" className="mobile-menu-btn" onClick={() => setMenuAberto(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="14" rx="1"/>
                <rect width="7" height="7" x="3" y="14" rx="1"/>
              </svg>
            </button>
            <div>
              <h1 className="responsive-h1 relatorios-page-header__h1">Relatórios Analíticos</h1>
              <p className="relatorios-page-header__sub">Receitas, despesas e composição por categoria no período</p>
            </div>
          </div>
          <div className="relatorios-export-btns">
            <button type="button" className="btn-secondary relatorios-btn-export" onClick={exportToCSV} disabled={transacoes.length === 0} title="Exportar CSV">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              <span className="desktop-only">CSV</span>
            </button>
            <button type="button" className="btn-primary btn-primary-dashboard relatorios-btn-export" onClick={exportToPDF} disabled={transacoes.length === 0} title="Baixar PDF">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span className="desktop-only">PDF</span>
            </button>
          </div>
        </header>

        <section className="relatorios-filter-shell" aria-label="Período e categoria">
          <div className="relatorios-filter-grid">
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
        </section>

        <div className="kpi-grid relatorios-kpi-strip">
          <div className="kpi-card relatorios-kpi relatorios-kpi--rec">
            <div className="kpi-header">
              <span>Total de receitas</span>
            </div>
            <div className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`} style={{ color: 'var(--success)' }}>
              {formatCurrency(summary.receitas)}
            </div>
          </div>

          <div className="kpi-card relatorios-kpi relatorios-kpi--des">
            <div className="kpi-header">
              <span>Total de despesas</span>
            </div>
            <div className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`} style={{ color: 'var(--danger)' }}>
              − {formatCurrency(summary.despesas)}
            </div>
          </div>

          <div className="kpi-card accent relatorios-kpi relatorios-kpi--saldo">
            <div className="kpi-header">
              <span>Saldo líquido (período)</span>
            </div>
            <div
              className={`kpi-value ${privacyMode ? 'privacy-blur' : ''} ${saldoPositivo ? 'relatorios-kpi-saldo--pos' : 'relatorios-kpi-saldo--neg'}`}
            >
              {formatCurrency(summary.saldo)}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="relatorios-loading-msg">Carregando dados do relatório…</p>
        ) : transacoes.length === 0 ? (
          <p className="relatorios-empty-msg">Nenhuma transação efetivada neste período para compor o relatório.</p>
        ) : (
          <div className="relatorios-charts">
            <article className="relatorios-chart-card relatorios-chart-card--wide">
              <div className="relatorios-chart-card__head">
                <h2 className="relatorios-chart-card__title">Evolução diária</h2>
                <p className="relatorios-chart-card__desc">Receitas e despesas por dia no período selecionado</p>
              </div>
              <div className="relatorios-chart-card__body">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataPorData} margin={{ top: 12, right: 12, left: 4, bottom: 4 }} barGap={2} barCategoryGap="18%">
                    <defs>
                      <linearGradient id="relGradRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity={1} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.92} />
                      </linearGradient>
                      <linearGradient id="relGradDes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke={axisColor} strokeOpacity={0.12} vertical={false} />
                    <XAxis dataKey="name" stroke={axisColor} fontSize={11} tickMargin={8} tick={{ fill: 'rgba(255,255,255,0.45)' }} axisLine={false} tickLine={false} />
                    <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.45)' }} tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`)} />
                    <Tooltip
                      content={(props) => <RelatoriosTooltip {...props} formatCurrency={formatCurrency} />}
                      cursor={{ fill: 'rgba(212, 168, 75, 0.06)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: 16, color: 'rgba(255,255,255,0.8)', fontSize: 13 }} />
                    <Bar dataKey="Receitas" fill="url(#relGradRec)" radius={isMobile ? [3, 3, 0, 0] : [6, 6, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="Despesas" fill="url(#relGradDes)" radius={isMobile ? [3, 3, 0, 0] : [6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="relatorios-chart-card relatorios-chart-card--wide">
              <div className="relatorios-chart-card__head">
                <h2 className="relatorios-chart-card__title">Saldo acumulado</h2>
                <p className="relatorios-chart-card__desc">Resultado líquido dia a dia no período (linha de referência em zero)</p>
              </div>
              <div className="relatorios-chart-card__body relatorios-chart-card__body--area">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDataSaldoCum} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="relGradSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke={axisColor} strokeOpacity={0.12} vertical={false} />
                    <XAxis dataKey="name" stroke={axisColor} fontSize={11} tickMargin={8} tick={{ fill: 'rgba(255,255,255,0.45)' }} axisLine={false} tickLine={false} />
                    <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.45)' }} tickFormatter={(v) => formatCurrency(v)} width={72} />
                    <ReferenceLine y={0} stroke="rgba(212,168,75,0.35)" strokeDasharray="4 4" />
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
                              <span className="relatorios-tooltip__name">No dia</span>
                              <span className="relatorios-tooltip__val">{formatCurrency(row?.liquidoDia)}</span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Area type="monotone" dataKey="saldo" stroke="#a78bfa" strokeWidth={2.5} fill="url(#relGradSaldo)" dot={{ r: 3, fill: '#c4b5fd', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <div className="relatorios-charts__pair">
              <article className="relatorios-chart-card">
                <div className="relatorios-chart-card__head">
                  <h2 className="relatorios-chart-card__title">Despesas por categoria</h2>
                  <p className="relatorios-chart-card__desc">Distribuição do que saiu no período</p>
                </div>
                <div className="relatorios-chart-card__body relatorios-chart-card__body--pie">
                  {chartDataPorCategoria.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartDataPorCategoria}
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={102}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="rgba(0,0,0,0.25)"
                          strokeWidth={1}
                        >
                          {chartDataPorCategoria.map((_, index) => (
                            <Cell key={`desp-${index}`} fill={COLORS_DESP[index % COLORS_DESP.length]} />
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
                          wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', paddingLeft: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="relatorios-chart-empty">Sem despesas no período.</div>
                  )}
                </div>
              </article>

              <article className="relatorios-chart-card">
                <div className="relatorios-chart-card__head">
                  <h2 className="relatorios-chart-card__title">Receitas por categoria</h2>
                  <p className="relatorios-chart-card__desc">De onde entrou dinheiro no período</p>
                </div>
                <div className="relatorios-chart-card__body relatorios-chart-card__body--pie">
                  {chartDataReceitasPorCategoria.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartDataReceitasPorCategoria}
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={102}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="rgba(0,0,0,0.25)"
                          strokeWidth={1}
                        >
                          {chartDataReceitasPorCategoria.map((_, index) => (
                            <Cell key={`rec-${index}`} fill={COLORS_REC[index % COLORS_REC.length]} />
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
                          wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', paddingLeft: 8 }}
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
      </main>
    </div>
  )
}

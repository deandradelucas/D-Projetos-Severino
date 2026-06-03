import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { redirectSe401 } from '../lib/authRedirect'
import { fetchWithRetry } from '../lib/fetchWithRetry'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { useRelatorioAggregates, computeRelatorioAggregates } from '../hooks/useRelatorioAggregates'
import { useMatchMaxWidth } from '../hooks/useMatchMaxWidth'
import { readHorizonteUserProfile, horizonteUserProfileTemId } from '../lib/horizonteSession'
import { getRelatorioChartPalette } from '../lib/relatorioChartTokens'
import { downloadRelatorioCsv } from '../lib/relatorioExportCsv'
import { buildRelatorioPdfDoc, downloadRelatorioPdf } from '../lib/relatorioExportPdf'
import { showToast } from '../lib/toastStore'
import { formatLocalDateISO, getFirstDayOfMonth, getLastDayOfMonth } from '../lib/dateUtils'
import { SkeletonKpi } from '../components/dashboard/DashboardSkeletons'
import { RelatoriosChartsLoadingShell } from '../components/relatorios/RelatoriosLoadingComponents'
import { tipoNormalizado, parseValorTransacao } from '../lib/transacaoUtils'
import './dashboard.css'

// Lazy: o bloco de gráficos (recharts ~pesado) carrega só depois do shell pintar.
const RelatoriosCharts = lazy(() => import('./relatorios/RelatoriosCharts'))

export default function Relatorios() {
  const { privacyMode, theme } = useTheme()
  const isDark = theme === 'dark'
  const chartMono = false
  const [usuario] = useState(() => readHorizonteUserProfile())

  // States
  const [menuAberto, setMenuAberto] = useState(false)
  const [transacoes, setTransacoes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [recorrenciasAtivas, setRecorrenciasAtivas] = useState([])
  const firstFetchDoneRef = useRef(false)
  const [loading, setLoading] = useState(() => horizonteUserProfileTemId(readHorizonteUserProfile()))
  const [refreshing, setRefreshing] = useState(false)
  const [pdfExportLoading, setPdfExportLoading] = useState(false)
  const isMobile = useMatchMaxWidth(768)

  // Filters State (default para o mês atual; R11 — lembra o último filtro usado)
  const [filters, setFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('horizonte_relatorios_filtros') || 'null')
      if (saved && saved.dataInicio && saved.dataFim) {
        return { dataInicio: saved.dataInicio, dataFim: saved.dataFim, categoria_id: saved.categoria_id || '' }
      }
    } catch { /* ignore */ }
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
    return {
      dataInicio: firstDay,
      dataFim: lastDay,
      categoria_id: ''
    }
  })

  // R11 — persiste o filtro escolhido
  useEffect(() => {
    try { localStorage.setItem('horizonte_relatorios_filtros', JSON.stringify(filters)) } catch { /* ignore */ }
  }, [filters])
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [prevSummary, setPrevSummary] = useState(null)
  const [limitesOrcamento, setLimitesOrcamento] = useState([])

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl('/api/categorias'), {
      })
      if (redirectSe401(res)) return
      if (res.ok) {
        const data = await res.json()
        setCategorias(data || [])
      }
    } catch (err) { console.error('[Relatorios] fetchCategorias:', err) }
  }, [])

  // R3 — limites mensais por categoria (Orçado vs Real)
  const fetchLimites = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl('/api/limites-orcamento'))
      if (redirectSe401(res)) return
      if (res.ok) {
        const data = await res.json()
        setLimitesOrcamento(Array.isArray(data) ? data : [])
      }
    } catch (err) { console.error('[Relatorios] fetchLimites:', err) }
  }, [])

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
        cache: 'no-store',
      }, { fetchImpl: apiFetch })
      if (redirectSe401(res)) return
      if (res.ok) {
        const data = await res.json()
        setTransacoes(data || [])
      }
    } catch (err) {
      console.error('[Relatorios] fetchTransacoes:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstFetchDoneRef.current = true
    }
  }, [filters])

  useEffect(() => {
    firstFetchDoneRef.current = false
  }, [usuario.id])

  // Carrega regras mensais ativas (assinaturas / "Prazo indeterminado") para
  // que o gráfico de Recorrentes possa projetar valores em meses futuros do
  // período onde o cron ainda não gerou o lançamento.
  const fetchRecorrenciasAtivas = useCallback(async () => {
    try {
      const res = await fetchWithRetry(apiUrl('/api/recorrencias-mensais'), { cache: 'no-store', }, { fetchImpl: apiFetch })
      if (redirectSe401(res)) return
      if (res.ok) {
        const data = await res.json()
        setRecorrenciasAtivas(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('[Relatorios] fetchRecorrenciasAtivas:', err)
    }
  }, [])

  useEffect(() => {
    if (usuario.id) {
      fetchCategorias()
      fetchTransacoes()
      fetchRecorrenciasAtivas()
      fetchLimites()
    }
  }, [usuario.id, fetchCategorias, fetchTransacoes, fetchRecorrenciasAtivas, fetchLimites])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const clearRelatorioFilters = useCallback(() => {
    const today = new Date()
    setFilters({ 
      dataInicio: formatLocalDateISO(getFirstDayOfMonth(today)), 
      dataFim: formatLocalDateISO(getLastDayOfMonth(today)), 
      categoria_id: '' 
    })
  }, [])

  const setPeriodShortcut = (type) => {
    const today = new Date()
    let start, end

    if (type === 'thisMonth') {
      start = getFirstDayOfMonth(today)
      end = getLastDayOfMonth(today)
    } else if (type === 'lastMonth') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
    } else if (type === 'last90') {
      start = new Date()
      start.setDate(today.getDate() - 90)
      end = today
    } else if (type === 'thisYear') {
      start = new Date(today.getFullYear(), 0, 1)
      end = new Date(today.getFullYear(), 11, 31)
    }

    setFilters(prev => ({
      ...prev,
      dataInicio: formatLocalDateISO(start),
      dataFim: formatLocalDateISO(end)
    }))
    showToast('Período atualizado')
  }

  // Lista de meses 'YYYY-MM' dentro do período filtrado — usada como base para
  // a projeção das recorrências ativas no gráfico de Recorrentes.
  const periodoMeses = useMemo(() => {
    if (!filters.dataInicio || !filters.dataFim) return null
    const start = new Date(filters.dataInicio)
    const end = new Date(filters.dataFim)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    const out = []
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    const limit = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cur <= limit) {
      out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
    return out
  }, [filters.dataInicio, filters.dataFim])

  const aggregateOptions = useMemo(
    () => ({ recorrenciasAtivas, periodoMeses }),
    [recorrenciasAtivas, periodoMeses]
  )

  const {
    summary,
    chartDataPorMes,
    chartDataComprasRecorrentesMes,
    totalComprasRecorrentesPeriodo,
    chartDataPorCategoria,
    chartDataReceitasPorCategoria,
  } = useRelatorioAggregates(transacoes, aggregateOptions)

  const totalPieDesp = useMemo(
    () => chartDataPorCategoria.reduce((s, x) => s + (Number(x.value) || 0), 0),
    [chartDataPorCategoria]
  )
  const totalPieRec = useMemo(
    () => chartDataReceitasPorCategoria.reduce((s, x) => s + (Number(x.value) || 0), 0),
    [chartDataReceitasPorCategoria]
  )

  const formatCurrency = formatCurrencyBRL

  // R1 — período anterior de mesmo tamanho, imediatamente antes do filtrado
  const prevRange = useMemo(() => {
    if (!filters.dataInicio || !filters.dataFim) return null
    const ini = new Date(`${filters.dataInicio}T00:00:00`)
    const fim = new Date(`${filters.dataFim}T00:00:00`)
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return null
    const lenDays = Math.round((fim - ini) / 86400000) + 1
    const prevFim = new Date(ini); prevFim.setDate(prevFim.getDate() - 1)
    const prevIni = new Date(prevFim); prevIni.setDate(prevIni.getDate() - (lenDays - 1))
    return { dataInicio: formatLocalDateISO(prevIni), dataFim: formatLocalDateISO(prevFim) }
  }, [filters.dataInicio, filters.dataFim])

  // Busca o resumo do período anterior para calcular as variações (% vs período anterior)
  useEffect(() => {
    if (!usuario.id || !prevRange) { setPrevSummary(null); return undefined }
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.append('dataInicio', prevRange.dataInicio)
        params.append('dataFim', prevRange.dataFim)
        if (filters.categoria_id) params.append('categoria_id', filters.categoria_id)
        params.append('limit', '500')
        params.append('status', 'EFETIVADA')
        const res = await fetchWithRetry(apiUrl(`/api/transacoes?${params.toString()}`), { cache: 'no-store' }, { fetchImpl: apiFetch })
        if (cancelled || !res.ok) return
        const data = await res.json()
        const agg = computeRelatorioAggregates(Array.isArray(data) ? data : [])
        if (!cancelled) setPrevSummary(agg.summary)
      } catch {
        if (!cancelled) setPrevSummary(null)
      }
    })()
    return () => { cancelled = true }
  }, [usuario.id, prevRange, filters.categoria_id])

  const pctDelta = (cur, prev) => {
    if (prev == null || prev === 0) return null
    return ((cur - prev) / Math.abs(prev)) * 100
  }
  const deltaReceitas = prevSummary ? pctDelta(summary.receitas, prevSummary.receitas) : null
  const deltaDespesas = prevSummary ? pctDelta(summary.despesas, prevSummary.despesas) : null

  // R5 — drill-down: clicar numa fatia do pie filtra por aquela categoria
  const drillCategoria = useCallback((name) => {
    if (!name || name === 'Sem categoria') return
    const cat = categorias.find((c) => c.nome === name)
    if (!cat) return
    setFilters((p) => ({ ...p, categoria_id: String(cat.id) }))
    showToast(`Filtrando por ${name}`)
  }, [categorias])

  // R6 — saldo acumulado mês a mês
  const chartDataSaldoAcumulado = useMemo(() => {
    let acc = 0
    return chartDataPorMes.map((m) => {
      acc += (m.Receitas - m.Despesas)
      return { name: m.name, Saldo: Math.round(acc * 100) / 100 }
    })
  }, [chartDataPorMes])

  // R7 — top 5 maiores despesas do período
  const top5Despesas = useMemo(() => (
    (transacoes || [])
      .filter((t) => tipoNormalizado(t.tipo) === 'DESPESA')
      .map((t) => ({
        id: t.id,
        desc: t.descricao || t.categorias?.nome || 'Despesa',
        cat: t.categorias?.nome || 'Sem categoria',
        valor: parseValorTransacao(t),
        data: t.data_transacao,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5)
  ), [transacoes])

  // R3 — orçado vs real: gasto no período por categoria vs limite mensal definido
  const orcadoVsReal = useMemo(() => {
    if (!limitesOrcamento.length) return []
    const spendByName = new Map(chartDataPorCategoria.map((c) => [c.name, c.value]))
    return limitesOrcamento
      .map((l) => {
        const cat = categorias.find((c) => String(c.id) === String(l.categoria_id))
        const limite = Number(l.limite_mensal) || 0
        if (!cat || limite <= 0) return null
        const gasto = spendByName.get(cat.nome) || 0
        return {
          id: l.categoria_id,
          nome: cat.nome,
          limite,
          gasto,
          pct: Math.min(100, Math.round((gasto / limite) * 100)),
          excedido: gasto > limite,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.gasto - a.gasto)
  }, [limitesOrcamento, categorias, chartDataPorCategoria])

  const exportToCSV = () => {
    try {
      downloadRelatorioCsv(transacoes, filters)
      showToast('CSV exportado com sucesso!')
    } catch {
      showToast('Erro ao exportar CSV', 'error')
    }
  }

  /**
   * Pré-aquece os chunks `vendor-jspdf`/`jspdf-autotable` no hover/focus do
   * botão de PDF. ~140 KB gz começam a baixar enquanto o cursor se move,
   * deixando o clique imperceptível para quem realmente exporta. O bundle
   * inicial não muda; o prefetch é descartável (catch silencioso).
   */
  const prefetchPdfDeps = () => {
    void Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]).catch(() => {})
  }

  const exportToPDF = async () => {
    if (transacoes.length === 0) return

    setPdfExportLoading(true)
    try {
      const [{ default: JsPdfCtor }, autoTableMod] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const doc = buildRelatorioPdfDoc(JsPdfCtor, autoTableMod.default, {
        transacoes,
        filtros: { dataInicio: filters.dataInicio, dataFim: filters.dataFim },
        summary,
        formatCurrency,
      })
      downloadRelatorioPdf(doc, { dataInicio: filters.dataInicio, dataFim: filters.dataFim })
      showToast('PDF gerado com sucesso!')
    } catch {
      showToast('Erro ao gerar PDF', 'error')
    } finally {
      setPdfExportLoading(false)
    }
  }

  const chart = getRelatorioChartPalette(chartMono)

  const relatoriosSaldoValorClass =
    summary.saldo > 0
      ? 'dashboard-hub__balance-value--positive'
      : summary.saldo < 0
        ? 'dashboard-hub__balance-value--negative'
        : 'dashboard-hub__balance-value--zero'

  const selectedCategoryName = useMemo(() => {
    if (!filters.categoria_id) return 'Todas as categorias'
    return categorias.find((cat) => String(cat.id) === String(filters.categoria_id))?.nome || 'Categoria selecionada'
  }, [categorias, filters.categoria_id])
  const periodLabel = useMemo(() => {
    const formatDate = (value) => {
      if (!value) return null
      return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }
    const start = formatDate(filters.dataInicio)
    const end = formatDate(filters.dataFim)
    return start && end ? `${start} a ${end}` : 'Período personalizado'
  }, [filters.dataFim, filters.dataInicio])

  // R8 — compartilha um resumo do período no WhatsApp
  const compartilharWhatsApp = () => {
    if (transacoes.length === 0) return
    const linhas = []
    linhas.push(`📊 *Relatório* — ${periodLabel}`)
    if (filters.categoria_id) linhas.push(`Categoria: ${selectedCategoryName}`)
    linhas.push('')
    linhas.push(`💰 Receitas: ${formatCurrency(summary.receitas)}`)
    linhas.push(`💸 Despesas: ${formatCurrency(summary.despesas)}`)
    linhas.push(`🧮 Saldo: ${formatCurrency(summary.saldo)}`)
    const maior = chartDataPorCategoria[0]
    if (maior) { linhas.push(''); linhas.push(`🔻 Maior gasto: ${maior.name} (${formatCurrency(maior.value)})`) }
    linhas.push('')
    linhas.push('_via Severino_')
    const url = `https://wa.me/?text=${encodeURIComponent(linhas.join('\n'))}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="dashboard-container page-relatorios ref-dashboard app-horizon-shell"
      style={{ '--rel-tooltip-bg': chart.tooltipBg }}
    >
      <div className="app-horizon-inner">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner dashboard-hub">
        <RefDashboardScroll>
        <section className="dashboard-hub__hero" aria-label="Relatórios e exportação">
          <div className="dashboard-hub__hero-row">
            <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
            <div className="dashboard-hub__hero-main">
              <div className="dashboard-hub__hero-top">
                <div className="dashboard-hub__hero-text">
                  <h1 className="dashboard-hub__title">Relatórios</h1>
                </div>
                <div className="dashboard-hub__hero-actions relatorios-header-export" role="toolbar" aria-label="Exportar relatório">
                  <button
                    type="button"
                    className="dashboard-hub__btn dashboard-hub__btn--secondary relatorios-btn-export"
                    onClick={exportToCSV}
                    disabled={transacoes.length === 0}
                    aria-label="Exportar relatório em CSV"
                    title="Exportar CSV"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    <span className="desktop-only">CSV</span>
                  </button>
                  <button
                    type="button"
                    className="dashboard-hub__btn dashboard-hub__btn--primary relatorios-btn-export"
                    onClick={exportToPDF}
                    onMouseEnter={prefetchPdfDeps}
                    onFocus={prefetchPdfDeps}
                    disabled={transacoes.length === 0 || pdfExportLoading}
                    aria-label={pdfExportLoading ? 'Gerando relatório em PDF' : 'Exportar relatório em PDF'}
                    title={pdfExportLoading ? 'Gerando PDF…' : 'Baixar PDF'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <span className="desktop-only">{pdfExportLoading ? '…' : 'PDF'}</span>
                  </button>
                  <button
                    type="button"
                    className="dashboard-hub__btn dashboard-hub__btn--secondary relatorios-btn-export"
                    onClick={compartilharWhatsApp}
                    disabled={transacoes.length === 0}
                    aria-label="Compartilhar resumo no WhatsApp"
                    title="Compartilhar resumo no WhatsApp"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>
                    <span className="desktop-only">Resumo</span>
                  </button>
                </div>
              </div>
              <div className="dashboard-hub__balance-line" aria-label="Saldo do período filtrado">
                <span className="dashboard-hub__balance-line-label">Saldo disponível:</span>
                <strong className={[privacyMode ? 'privacy-blur' : '', relatoriosSaldoValorClass].filter(Boolean).join(' ')}>
                  {formatCurrency(summary.saldo)}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`ref-kpi-row relatorios-kpi-row--2col${refreshing ? ' relatorios-kpi-row--refreshing' : ''}`}
          aria-label="Resumo do período"
          aria-busy={loading || refreshing}
        >
          {loading ? (
            <>
              <SkeletonKpi />
              <SkeletonKpi />
            </>
          ) : (
            <>
              <article className="ref-kpi-card ref-kpi-card--income">
                <div className="ref-kpi-card__icon" aria-hidden>
                  <img
                    className="ref-kpi-card__icon-img"
                    src="/images/icons/setacima.png"
                    alt=""
                    width={22}
                    height={22}
                    decoding="async"
                  />
                </div>
                <div className="ref-kpi-card__body">
                  <p className="ref-kpi-card__label">Receitas</p>
                  <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(summary.receitas)}</p>
                  {deltaReceitas != null && (
                    <span className={`relatorios-kpi-delta ${deltaReceitas >= 0 ? 'relatorios-kpi-delta--good' : 'relatorios-kpi-delta--bad'}`} title="vs período anterior">
                      {deltaReceitas >= 0 ? '▲' : '▼'} {Math.abs(deltaReceitas).toFixed(0)}% vs anterior
                    </span>
                  )}
                </div>
              </article>
              <article className="ref-kpi-card ref-kpi-card--expense">
                <div className="ref-kpi-card__icon" aria-hidden>
                  <img
                    className="ref-kpi-card__icon-img"
                    src="/images/icons/setabaixo.png"
                    alt=""
                    width={22}
                    height={22}
                    decoding="async"
                  />
                </div>
                <div className="ref-kpi-card__body">
                  <p className="ref-kpi-card__label">Despesas</p>
                  <p className={`ref-kpi-card__value ref-kpi-card__value--signed ${privacyMode ? 'privacy-blur' : ''}`}>
                    −{'\u00a0'}
                    {formatCurrency(summary.despesas)}
                  </p>
                  {deltaDespesas != null && (
                    <span className={`relatorios-kpi-delta ${deltaDespesas > 0 ? 'relatorios-kpi-delta--bad' : 'relatorios-kpi-delta--good'}`} title="vs período anterior">
                      {deltaDespesas >= 0 ? '▲' : '▼'} {Math.abs(deltaDespesas).toFixed(0)}% vs anterior
                    </span>
                  )}
                </div>
              </article>
            </>
          )}
        </section>

        {/* Insights strip */}
        {!loading && transacoes.length > 0 && (() => {
          const taxaPoupanca = summary.receitas > 0 ? Math.max(0, (summary.saldo / summary.receitas) * 100) : 0
          const maiorDesp = chartDataPorCategoria[0]
          const nDespesas = transacoes.filter((t) => t.tipo === 'DESPESA').length
          const ticketMedio = nDespesas > 0 ? summary.despesas / nDespesas : 0
          const diasPeriodo = filters.dataInicio && filters.dataFim
            ? Math.max(1, Math.round((new Date(filters.dataFim) - new Date(filters.dataInicio)) / 86400000) + 1)
            : null
          // R4 — maior receita por categoria + média diária de gasto
          const maiorReceita = chartDataReceitasPorCategoria[0]
          const mediaDiaria = diasPeriodo ? summary.despesas / diasPeriodo : 0
          // R2 — projeção de fim do período (só quando o período inclui hoje e ainda não terminou)
          const hojeP = new Date(); hojeP.setHours(0, 0, 0, 0)
          const iniP = filters.dataInicio ? new Date(`${filters.dataInicio}T00:00:00`) : null
          const fimP = filters.dataFim ? new Date(`${filters.dataFim}T00:00:00`) : null
          let projecao = null
          if (iniP && fimP && diasPeriodo && hojeP >= iniP && hojeP < fimP) {
            const diasDecorridos = Math.max(1, Math.round((hojeP - iniP) / 86400000) + 1)
            if (diasDecorridos < diasPeriodo) {
              const despProj = (summary.despesas / diasDecorridos) * diasPeriodo
              projecao = { despProj, saldoProj: summary.receitas - despProj }
            }
          }
          return (
            <div className="relatorios-insights" aria-label="Insights do período">
              <div className="relatorios-insights__item relatorios-insights__item--wide">
                <div className="relatorios-insights__item-head">
                  <p className="relatorios-insights__label">Taxa de poupança</p>
                  <p className={`relatorios-insights__value ${privacyMode ? 'privacy-blur' : ''}`}>
                    {taxaPoupanca.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </p>
                </div>
                <div className="relatorios-insights__bar">
                  <div
                    className={`relatorios-insights__bar-fill${taxaPoupanca >= 20 ? ' relatorios-insights__bar-fill--pos' : taxaPoupanca > 0 ? ' relatorios-insights__bar-fill--warn' : ' relatorios-insights__bar-fill--neg'}`}
                    style={{ width: `${Math.min(taxaPoupanca, 100).toFixed(2)}%` }}
                  />
                </div>
                <p className="relatorios-insights__hint">
                  {taxaPoupanca >= 20 ? 'Ótimo! Acima de 20%' : taxaPoupanca > 0 ? 'Abaixo do ideal (20%)' : 'Gastos maiores que receitas'}
                </p>
              </div>
              {maiorDesp && (
                <div className="relatorios-insights__item">
                  <p className="relatorios-insights__label">Maior gasto</p>
                  <p className="relatorios-insights__value relatorios-insights__value--cat" title={maiorDesp.name}>{maiorDesp.name}</p>
                  <p className={`relatorios-insights__sub ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(maiorDesp.value)}</p>
                </div>
              )}
              {maiorReceita && (
                <div className="relatorios-insights__item">
                  <p className="relatorios-insights__label">Maior receita</p>
                  <p className="relatorios-insights__value relatorios-insights__value--cat" title={maiorReceita.name}>{maiorReceita.name}</p>
                  <p className={`relatorios-insights__sub ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(maiorReceita.value)}</p>
                </div>
              )}
              {ticketMedio > 0 && (
                <div className="relatorios-insights__item">
                  <p className="relatorios-insights__label">Ticket médio</p>
                  <p className={`relatorios-insights__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(ticketMedio)}</p>
                  <p className="relatorios-insights__sub">{nDespesas} {nDespesas === 1 ? 'despesa' : 'despesas'}</p>
                </div>
              )}
              {mediaDiaria > 0 && (
                <div className="relatorios-insights__item">
                  <p className="relatorios-insights__label">Média diária</p>
                  <p className={`relatorios-insights__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(mediaDiaria)}</p>
                  <p className="relatorios-insights__sub">de gasto por dia</p>
                </div>
              )}
              {diasPeriodo && (
                <div className="relatorios-insights__item">
                  <p className="relatorios-insights__label">Período</p>
                  <p className="relatorios-insights__value">{diasPeriodo}</p>
                  <p className="relatorios-insights__sub">dias analisados</p>
                </div>
              )}
              {projecao && (
                <div className="relatorios-insights__item relatorios-insights__item--wide">
                  <p className="relatorios-insights__label">Projeção de fim do período</p>
                  <p className={`relatorios-insights__value ${privacyMode ? 'privacy-blur' : ''} ${projecao.saldoProj >= 0 ? 'relatorios-insights__value--pos' : 'relatorios-insights__value--neg'}`}>
                    Saldo ~ {formatCurrency(projecao.saldoProj)}
                  </p>
                  <p className={`relatorios-insights__hint ${privacyMode ? 'privacy-blur' : ''}`}>
                    No ritmo atual, despesas devem chegar a ~ {formatCurrency(projecao.despProj)}
                  </p>
                </div>
              )}
            </div>
          )
        })()}

        <article
          className={`ref-panel page-relatorios-ref-filters page-relatorios-ref-filters--clean ${filtrosAbertos ? '' : 'page-relatorios-ref-filters--collapsed'}`}
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
                <span className="relatorios-filter-summary">
                  {periodLabel} · {selectedCategoryName}
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
              <div className="relatorios-shortcuts-row">
                <button type="button" onClick={() => setPeriodShortcut('thisMonth')} className="relatorios-shortcut-btn">Mês atual</button>
                <button type="button" onClick={() => setPeriodShortcut('lastMonth')} className="relatorios-shortcut-btn">Mês passado</button>
                <button type="button" onClick={() => setPeriodShortcut('last90')} className="relatorios-shortcut-btn">90 dias</button>
                <button type="button" onClick={() => setPeriodShortcut('thisYear')} className="relatorios-shortcut-btn">Ano</button>
              </div>
              <div className="filter-group">
                <label htmlFor="rel-ini">Início</label>
                <input id="rel-ini" type="date" name="dataInicio" className="filter-input" value={filters.dataInicio} onChange={handleFilterChange} />
              </div>
              <div className="filter-group">
                <label htmlFor="rel-fim">Fim</label>
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

        {loading ? (
          <RelatoriosChartsLoadingShell />
        ) : transacoes.length === 0 ? (
          <div className="relatorios-empty">
            <span className="relatorios-empty__icon" aria-hidden>📊</span>
            <h2 className="relatorios-empty__title">Nada por aqui neste período</h2>
            <p className="relatorios-empty__text">
              Não há transações efetivadas em {periodLabel}
              {filters.categoria_id ? ` para ${selectedCategoryName}` : ''}. Ajuste o período ou limpe os filtros.
            </p>
            <button type="button" className="relatorios-empty__btn" onClick={clearRelatorioFilters}>
              Limpar filtros
            </button>
          </div>
        ) : (
          <Suspense fallback={<RelatoriosChartsLoadingShell />}>
            <RelatoriosCharts
              refreshing={refreshing}
              chartDataPorMes={chartDataPorMes}
              chartDataSaldoAcumulado={chartDataSaldoAcumulado}
              chartDataPorCategoria={chartDataPorCategoria}
              chartDataReceitasPorCategoria={chartDataReceitasPorCategoria}
              chartDataComprasRecorrentesMes={chartDataComprasRecorrentesMes}
              totalComprasRecorrentesPeriodo={totalComprasRecorrentesPeriodo}
              totalPieDesp={totalPieDesp}
              totalPieRec={totalPieRec}
              orcadoVsReal={orcadoVsReal}
              top5Despesas={top5Despesas}
              isMobile={isMobile}
              isDark={isDark}
              chart={chart}
              formatCurrency={formatCurrency}
              privacyMode={privacyMode}
              drillCategoria={drillCategoria}
            />
          </Suspense>
        )}
        </RefDashboardScroll>
        </div>
      </main>
      </div>
    </div>
  )
}

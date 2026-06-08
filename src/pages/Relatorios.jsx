import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { redirectSe401 } from '../lib/authRedirect'
import { fetchCategorias as fetchCategoriasApi } from '../lib/apiCategorias'
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
import { RelatoriosChartsLoadingShell } from '../components/relatorios/RelatoriosLoadingComponents'
import { labelMesBr } from '../lib/transacaoUtils'
import {
  computePrevRange,
  pctDelta,
  computeSaldoAcumulado,
  computeTop5Despesas,
  computeOrcadoVsReal,
  computeFixoVsVariavel,
  computeVariacaoCategorias,
} from '../lib/relatoriosDerived'
import './dashboard.css'

// Lazy: o bloco de gráficos (recharts ~pesado) carrega só depois do shell pintar.
const RelatoriosCharts = lazy(() => import('./relatorios/RelatoriosCharts'))

/**
 * Markdown leve para a análise da IA: escapa HTML (nomes de categoria são
 * conteúdo do usuário → evita XSS) e converte **negrito** + quebras de linha.
 */
function renderIaAnalise(text) {
  const esc = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const inner = esc
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br/>')
  return `<p>${inner}</p>`
}

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
  const [prevCategorias, setPrevCategorias] = useState(null)
  const [limitesOrcamento, setLimitesOrcamento] = useState([])

  // Análise narrativa por IA (Severino) — sob demanda para economizar Gemini.
  const [iaAnalise, setIaAnalise] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [iaErro, setIaErro] = useState(null)

  // Linha do tempo histórica (independente do filtro de período): últimos N meses.
  const [timelineMeses, setTimelineMeses] = useState(12)
  const [timelineRaw, setTimelineRaw] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(true)

  const fetchCategorias = useCallback(async () => {
    const data = await fetchCategoriasApi()
    if (data) setCategorias(data)
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

  // Linha do tempo: fetch próprio, independente do filtro de período da tela.
  const fetchTimeline = useCallback(async (meses) => {
    setTimelineLoading(true)
    try {
      const res = await fetchWithRetry(apiUrl(`/api/relatorios/resumo-mensal?meses=${meses}`), { cache: 'no-store' }, { fetchImpl: apiFetch })
      if (redirectSe401(res)) return
      if (res.ok) {
        const data = await res.json()
        setTimelineRaw(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('[Relatorios] fetchTimeline:', err)
    } finally {
      setTimelineLoading(false)
    }
  }, [])

  useEffect(() => {
    if (usuario.id) fetchTimeline(timelineMeses)
  }, [usuario.id, timelineMeses, fetchTimeline])

  const chartDataTimeline = useMemo(
    () => (timelineRaw || []).map((r) => ({
      name: labelMesBr(r.ym),
      Receitas: Number(r.receitas) || 0,
      Despesas: Number(r.despesas) || 0,
    })),
    [timelineRaw]
  )

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

  // Qual atalho de período corresponde ao filtro atual (para destacar o chip ativo).
  const activePeriodId = useMemo(() => {
    const today = new Date()
    const presets = {
      thisMonth: [getFirstDayOfMonth(today), getLastDayOfMonth(today)],
      lastMonth: [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)],
      thisYear: [new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31)],
    }
    for (const [id, [s, e]] of Object.entries(presets)) {
      if (filters.dataInicio === formatLocalDateISO(s) && filters.dataFim === formatLocalDateISO(e)) return id
    }
    const s90 = new Date(); s90.setDate(today.getDate() - 90)
    if (filters.dataInicio === formatLocalDateISO(s90) && filters.dataFim === formatLocalDateISO(today)) return 'last90'
    return null
  }, [filters.dataInicio, filters.dataFim])

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
  const prevRange = useMemo(
    () => computePrevRange({ dataInicio: filters.dataInicio, dataFim: filters.dataFim }),
    [filters.dataInicio, filters.dataFim],
  )

  // Busca o resumo do período anterior para calcular as variações (% vs período anterior)
  useEffect(() => {
    if (!usuario.id || !prevRange) { setPrevSummary(null); setPrevCategorias(null); return undefined }
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
        if (!cancelled) {
          setPrevSummary(agg.summary)
          setPrevCategorias(agg.chartDataPorCategoria)
        }
      } catch {
        if (!cancelled) { setPrevSummary(null); setPrevCategorias(null) }
      }
    })()
    return () => { cancelled = true }
  }, [usuario.id, prevRange, filters.categoria_id])

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
  const chartDataSaldoAcumulado = useMemo(() => computeSaldoAcumulado(chartDataPorMes), [chartDataPorMes])

  // R7 — top 5 maiores despesas do período
  const top5Despesas = useMemo(() => computeTop5Despesas(transacoes), [transacoes])

  // R3 — orçado vs real: gasto no período por categoria vs limite mensal definido
  const orcadoVsReal = useMemo(
    () => computeOrcadoVsReal(limitesOrcamento, categorias, chartDataPorCategoria),
    [limitesOrcamento, categorias, chartDataPorCategoria],
  )

  // Feature 2 — Fixo vs Variável + comprometimento da renda.
  // Fixo = despesas recorrentes (regra mensal) ou parceladas; o resto é variável.
  // Usa transações reais do período (sem projeção) para refletir o que de fato saiu.
  const fixoVsVariavel = useMemo(
    () => computeFixoVsVariavel(transacoes, summary.receitas),
    [transacoes, summary.receitas],
  )

  // Feature 1 — Variação por categoria vs período anterior (só faz sentido sem
  // filtro de categoria; com filtro há uma categoria só). chartDataPorCategoria
  // é de DESPESAS, então subir = gastar mais (ruim), cair = gastar menos (bom).
  const variacaoCategorias = useMemo(
    () => computeVariacaoCategorias(prevCategorias, chartDataPorCategoria, filters.categoria_id),
    [prevCategorias, chartDataPorCategoria, filters.categoria_id],
  )

  // Invalida a análise da IA quando o período/categoria muda (dados mudaram).
  useEffect(() => {
    setIaAnalise('')
    setIaErro(null)
  }, [filters.dataInicio, filters.dataFim, filters.categoria_id])

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

  // Feature 3 — gera a análise narrativa da IA enviando os agregados já
  // computados (respeita o filtro de período/categoria que está na tela).
  const gerarAnaliseIA = useCallback(async () => {
    if (iaLoading || transacoes.length === 0) return
    setIaLoading(true)
    setIaErro(null)
    try {
      const taxaPoupanca = summary.receitas > 0 ? Math.max(0, (summary.saldo / summary.receitas) * 100) : 0
      const dados = {
        periodoLabel: `${periodLabel}${filters.categoria_id ? ` · ${selectedCategoryName}` : ''}`,
        receitas: summary.receitas,
        despesas: summary.despesas,
        saldo: summary.saldo,
        taxaPoupanca,
        fixo: fixoVsVariavel.fixo,
        variavel: fixoVsVariavel.variavel,
        comprometimento: fixoVsVariavel.comprometimento,
        topDespesas: chartDataPorCategoria.slice(0, 5).map((c) => ({ nome: c.name, valor: c.value })),
        topReceitas: chartDataReceitasPorCategoria.slice(0, 5).map((c) => ({ nome: c.name, valor: c.value })),
        variacoes: variacaoCategorias.slice(0, 6).map((v) => ({ nome: v.name, diff: v.diff, pct: v.pct })),
        deltaReceitas,
        deltaDespesas,
      }
      const res = await apiFetch(apiUrl('/api/ai/analise-relatorio'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dados }),
      })
      if (redirectSe401(res)) return
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || 'Não foi possível gerar a análise agora.')
      const resposta = data?.resposta
      if (typeof resposta !== 'string' || !resposta.trim()) throw new Error('A IA não retornou uma análise. Tente novamente.')
      setIaAnalise(resposta.trim())
    } catch (e) {
      setIaErro(e?.message || 'Erro ao gerar análise.')
    } finally {
      setIaLoading(false)
    }
  }, [iaLoading, transacoes.length, summary, periodLabel, selectedCategoryName, filters.categoria_id, fixoVsVariavel, chartDataPorCategoria, chartDataReceitasPorCategoria, variacaoCategorias, deltaReceitas, deltaDespesas])

  return (
    <div
      className="dashboard-container page-relatorios page-relatorios--editorial ref-dashboard app-horizon-shell"
      style={{ '--rel-tooltip-bg': chart.tooltipBg }}
    >
      <div className="app-horizon-inner">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner dashboard-hub">
        <RefDashboardScroll>
        <header className="rel-ed__hero" aria-label="Relatórios e exportação">
          <div className="rel-ed__hero-top">
            <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
            <div className="rel-ed__heading">
              <h1 className="rel-ed__title">Relatórios</h1>
              <p className="rel-ed__period">{periodLabel} · {selectedCategoryName}</p>
            </div>
            <div className="rel-ed__actions" role="toolbar" aria-label="Exportar relatório">
                  <button
                    type="button"
                    className="rel-ed__action"
                    onClick={exportToCSV}
                    disabled={transacoes.length === 0}
                    aria-label="Exportar relatório em CSV"
                    title="Exportar CSV"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    <span className="rel-ed__action-label desktop-only">CSV</span>
                  </button>
                  <button
                    type="button"
                    className="rel-ed__action rel-ed__action--primary"
                    onClick={exportToPDF}
                    onMouseEnter={prefetchPdfDeps}
                    onFocus={prefetchPdfDeps}
                    disabled={transacoes.length === 0 || pdfExportLoading}
                    aria-label={pdfExportLoading ? 'Gerando relatório em PDF' : 'Exportar relatório em PDF'}
                    title={pdfExportLoading ? 'Gerando PDF…' : 'Baixar PDF'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <span className="rel-ed__action-label desktop-only">{pdfExportLoading ? '…' : 'PDF'}</span>
                  </button>
                  <button
                    type="button"
                    className="rel-ed__action"
                    onClick={compartilharWhatsApp}
                    disabled={transacoes.length === 0}
                    aria-label="Compartilhar resumo no WhatsApp"
                    title="Compartilhar resumo no WhatsApp"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>
                    <span className="rel-ed__action-label desktop-only">Resumo</span>
                  </button>
              </div>
            </div>

            <div className="rel-ed__balance" aria-label="Saldo do período" aria-busy={loading || refreshing}>
              <p className="rel-ed__balance-label">Saldo do período</p>
              {loading ? (
                <div className="rel-ed__balance-skel" aria-hidden />
              ) : (
                <p className={['rel-ed__balance-value', relatoriosSaldoValorClass, privacyMode ? 'privacy-blur' : ''].filter(Boolean).join(' ')}>
                  {formatCurrency(summary.saldo)}
                </p>
              )}
            </div>

            <div className="rel-ed__totals" aria-busy={loading || refreshing}>
              {loading ? (
                <>
                  <div className="rel-ed__total rel-ed__total--skel" aria-hidden />
                  <div className="rel-ed__total rel-ed__total--skel" aria-hidden />
                </>
              ) : (
                <>
                  <div className="rel-ed__total rel-ed__total--in">
                    <span className="rel-ed__total-label">Receitas</span>
                    <span className={`rel-ed__total-value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(summary.receitas)}</span>
                    {deltaReceitas != null && (
                      <span
                        className={`rel-ed__delta ${deltaReceitas >= 0 ? 'rel-ed__delta--good' : 'rel-ed__delta--bad'}`}
                        aria-label={`${deltaReceitas >= 0 ? 'Alta de' : 'Queda de'} ${Math.abs(deltaReceitas).toFixed(0)}% vs período anterior`}
                      >
                        <span aria-hidden="true">{deltaReceitas >= 0 ? '▲' : '▼'}</span>{' '}{Math.abs(deltaReceitas).toFixed(0)}% vs anterior
                      </span>
                    )}
                  </div>
                  <div className="rel-ed__total rel-ed__total--out">
                    <span className="rel-ed__total-label">Despesas</span>
                    <span className={`rel-ed__total-value ${privacyMode ? 'privacy-blur' : ''}`}>−{' '}{formatCurrency(summary.despesas)}</span>
                    {deltaDespesas != null && (
                      <span
                        className={`rel-ed__delta ${deltaDespesas > 0 ? 'rel-ed__delta--bad' : 'rel-ed__delta--good'}`}
                        aria-label={`${deltaDespesas >= 0 ? 'Alta de' : 'Queda de'} ${Math.abs(deltaDespesas).toFixed(0)}% vs período anterior`}
                      >
                        <span aria-hidden="true">{deltaDespesas >= 0 ? '▲' : '▼'}</span>{' '}{Math.abs(deltaDespesas).toFixed(0)}% vs anterior
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
        </header>

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
            <section className="rel-ed__stats" aria-label="Insights do período">
              <div className="rel-ed__stat rel-ed__stat--wide">
                <p className="rel-ed__stat-label">Taxa de poupança</p>
                <div className="rel-ed__savings">
                  <p className={`rel-ed__stat-value ${privacyMode ? 'privacy-blur' : ''}`}>
                    {taxaPoupanca.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </p>
                  <p className="rel-ed__stat-hint">
                    {taxaPoupanca >= 20 ? 'Ótimo! Acima de 20%' : taxaPoupanca > 0 ? 'Abaixo do ideal (20%)' : 'Gastos maiores que receitas'}
                  </p>
                </div>
                <div className="rel-ed__savings-bar">
                  <div
                    className={`rel-ed__savings-fill${taxaPoupanca >= 20 ? ' rel-ed__savings-fill--pos' : taxaPoupanca > 0 ? ' rel-ed__savings-fill--warn' : ' rel-ed__savings-fill--neg'}`}
                    style={{ width: `${Math.min(taxaPoupanca, 100).toFixed(2)}%` }}
                  />
                </div>
              </div>
              {fixoVsVariavel.total > 0 && (
                <div className="rel-ed__stat rel-ed__stat--wide">
                  <p className="rel-ed__stat-label">Comprometimento da renda</p>
                  <div className="rel-ed__savings">
                    <p className={`rel-ed__stat-value ${privacyMode ? 'privacy-blur' : ''}`}>
                      {fixoVsVariavel.comprometimento != null ? `${Math.round(fixoVsVariavel.comprometimento)}%` : '—'}
                    </p>
                    <p className="rel-ed__stat-hint">
                      {fixoVsVariavel.comprometimento == null
                        ? 'Sem receitas no período para comparar'
                        : fixoVsVariavel.comprometimento <= 50
                          ? 'Saudável — fixas até 50% da renda'
                          : fixoVsVariavel.comprometimento <= 70
                            ? 'Atenção — fixas acima de 50% da renda'
                            : 'Apertado — fixas comprometem muito da renda'}
                    </p>
                  </div>
                  <div className="rel-ed__split" aria-hidden="true">
                    <span className="rel-ed__split-fill" style={{ width: `${fixoVsVariavel.pctFixo.toFixed(1)}%` }} />
                  </div>
                  <div className="rel-ed__split-legend">
                    <span className="rel-ed__split-key">
                      <i className="rel-ed__split-dot rel-ed__split-dot--fix" />
                      Fixas <b className={privacyMode ? 'privacy-blur' : ''}>{formatCurrency(fixoVsVariavel.fixo)}</b>
                    </span>
                    <span className="rel-ed__split-key">
                      <i className="rel-ed__split-dot rel-ed__split-dot--var" />
                      Variáveis <b className={privacyMode ? 'privacy-blur' : ''}>{formatCurrency(fixoVsVariavel.variavel)}</b>
                    </span>
                  </div>
                </div>
              )}
              {maiorDesp && (
                <div className="rel-ed__stat">
                  <p className="rel-ed__stat-label">Maior gasto</p>
                  <p className="rel-ed__stat-value rel-ed__stat-value--cat" title={maiorDesp.name}>{maiorDesp.name}</p>
                  <p className={`rel-ed__stat-sub ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(maiorDesp.value)}</p>
                </div>
              )}
              {maiorReceita && (
                <div className="rel-ed__stat">
                  <p className="rel-ed__stat-label">Maior receita</p>
                  <p className="rel-ed__stat-value rel-ed__stat-value--cat" title={maiorReceita.name}>{maiorReceita.name}</p>
                  <p className={`rel-ed__stat-sub ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(maiorReceita.value)}</p>
                </div>
              )}
              {ticketMedio > 0 && (
                <div className="rel-ed__stat">
                  <p className="rel-ed__stat-label">Ticket médio</p>
                  <p className={`rel-ed__stat-value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(ticketMedio)}</p>
                  <p className="rel-ed__stat-sub">{nDespesas} {nDespesas === 1 ? 'despesa' : 'despesas'}</p>
                </div>
              )}
              {mediaDiaria > 0 && (
                <div className="rel-ed__stat">
                  <p className="rel-ed__stat-label">Média diária</p>
                  <p className={`rel-ed__stat-value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(mediaDiaria)}</p>
                  <p className="rel-ed__stat-sub">de gasto por dia</p>
                </div>
              )}
              {diasPeriodo && (
                <div className="rel-ed__stat">
                  <p className="rel-ed__stat-label">Período</p>
                  <p className="rel-ed__stat-value">{diasPeriodo}</p>
                  <p className="rel-ed__stat-sub">dias analisados</p>
                </div>
              )}
              {projecao && (
                <div className="rel-ed__stat rel-ed__stat--wide">
                  <p className="rel-ed__stat-label">Projeção de fim do período</p>
                  <p className={`rel-ed__stat-value ${privacyMode ? 'privacy-blur' : ''} ${projecao.saldoProj >= 0 ? 'rel-ed__stat-value--pos' : 'rel-ed__stat-value--neg'}`}>
                    Saldo ~ {formatCurrency(projecao.saldoProj)}
                  </p>
                  <p className={`rel-ed__stat-hint ${privacyMode ? 'privacy-blur' : ''}`}>
                    No ritmo atual, despesas devem chegar a ~ {formatCurrency(projecao.despProj)}
                  </p>
                </div>
              )}
            </section>
          )
        })()}

        {/* Análise narrativa por IA (Severino) — sob demanda */}
        {!loading && transacoes.length > 0 && (
          <section className="rel-ed__ia" aria-label="Análise do Severino">
            <div className="rel-ed__ia-head">
              <span className="rel-ed__ia-title">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                  <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
                </svg>
                Análise do Severino
              </span>
              {iaAnalise && !iaLoading && (
                <button
                  type="button"
                  className="rel-ed__ia-refresh"
                  onClick={gerarAnaliseIA}
                  aria-label="Gerar análise novamente"
                  title="Gerar novamente"
                >
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
              )}
            </div>

            {iaLoading ? (
              <div className="rel-ed__ia-loading" role="status">
                <span className="rel-ed__ia-dots" aria-hidden="true"><i /><i /><i /></span>
                Severino está analisando seu período…
              </div>
            ) : iaErro ? (
              <p className="rel-ed__ia-erro">
                {iaErro}{' '}
                <button type="button" className="rel-ed__ia-link" onClick={gerarAnaliseIA}>Tentar de novo</button>
              </p>
            ) : iaAnalise ? (
              <div
                className={`rel-ed__ia-text ${privacyMode ? 'privacy-blur' : ''}`}
                dangerouslySetInnerHTML={{ __html: renderIaAnalise(iaAnalise) }}
              />
            ) : (
              <div className="rel-ed__ia-empty">
                <button type="button" className="rel-ed__ia-btn" onClick={gerarAnaliseIA}>
                  Gerar análise
                </button>
              </div>
            )}
          </section>
        )}

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

        {/* Filtro rápido de período — chips, abaixo do painel de Filtros */}
        <div className="rel-ed__quick" role="toolbar" aria-label="Filtro rápido de período">
          {[
            { id: 'thisMonth', label: 'Mês atual' },
            { id: 'lastMonth', label: 'Mês passado' },
            { id: 'last90', label: '90 dias' },
            { id: 'thisYear', label: 'Ano' },
          ].map((qf) => (
            <button
              key={qf.id}
              type="button"
              className={`rel-ed__quick-chip${activePeriodId === qf.id ? ' rel-ed__quick-chip--active' : ''}`}
              aria-pressed={activePeriodId === qf.id}
              onClick={() => setPeriodShortcut(qf.id)}
            >
              {qf.label}
            </button>
          ))}
          {filters.categoria_id && (
            <button
              type="button"
              className="rel-ed__quick-chip rel-ed__quick-chip--reset"
              onClick={() => setFilters((p) => ({ ...p, categoria_id: '' }))}
            >
              {selectedCategoryName} ✕
            </button>
          )}
        </div>

        {loading ? (
          <RelatoriosChartsLoadingShell />
        ) : transacoes.length === 0 ? (
          <div className="relatorios-empty">
            <svg className="relatorios-empty__icon" aria-hidden="true" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
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
              variacaoCategorias={variacaoCategorias}
              chartDataTimeline={chartDataTimeline}
              timelineMeses={timelineMeses}
              setTimelineMeses={setTimelineMeses}
              timelineLoading={timelineLoading}
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

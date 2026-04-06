import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import { useTheme } from '../context/ThemeContext'
import './dashboard.css'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#E67E22', '#E74C3C', '#9B59B6', '#34495E']

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
  const [loading, setLoading] = useState(false)

  // Filters State (default para o mês atual)
  const [filters, setFilters] = useState(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
    return {
      dataInicio: firstDay,
      dataFim: lastDay,
    }
  })

  // Fetch Transacoes
  const fetchTransacoes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio)
      if (filters.dataFim) params.append('dataFim', filters.dataFim)
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
      fetchTransacoes()
    }
  }, [usuario.id, fetchTransacoes])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  // Memoized aggregations
  const { summary, chartDataPorData, chartDataPorCategoria } = useMemo(() => {
    let receitas = 0
    let despesas = 0

    const dataMap = {}
    const catMap = {}

    transacoes.forEach(t => {
      const val = parseFloat(t.valor) || 0
      const dRaw = t.data_transacao.split('T')[0] // 'YYYY-MM-DD'

      if (!dataMap[dRaw]) {
        dataMap[dRaw] = { name: dRaw, Receitas: 0, Despesas: 0 }
      }

      if (t.tipo === 'RECEITA') {
        receitas += val
        dataMap[dRaw].Receitas += val
      } else {
        despesas += val
        dataMap[dRaw].Despesas += val
        
        // Agrupar despesas por categoria para o Pie Chart
        const catName = t.categorias?.nome || 'Sem categoria'
        if (!catMap[catName]) {
          catMap[catName] = 0
        }
        catMap[catName] += val
      }
    })

    // Converter para array e ordenar por data
    const chartDataPorData = Object.values(dataMap).sort((a, b) => a.name.localeCompare(b.name)).map(item => ({
      ...item,
      // Opcional: formatar a data para 'DD/MM' no gráfico
      name: new Date(item.name).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }))

    // Converter categorias para array
    const chartDataPorCategoria = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value) // Maior despesa primeiro

    return {
      summary: { receitas, despesas, saldo: receitas - despesas },
      chartDataPorData,
      chartDataPorCategoria
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

  return (
    <div className="dashboard-container">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10">
        <header className="top-header">
           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="mobile-menu-btn" onClick={() => setMenuAberto(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Relatórios Analíticos</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" onClick={exportToCSV} disabled={transacoes.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              Exportar CSV
            </button>
            <button className="btn-primary" onClick={exportToPDF} disabled={transacoes.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Baixar PDF
            </button>
          </div>
        </header>

        {/* Filters Bar */}
        <div className="filter-bar">
          <div className="filter-group">
            <label>Data Início</label>
            <input type="date" name="dataInicio" className="filter-input" value={filters.dataInicio} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label>Data Fim</label>
            <input type="date" name="dataFim" className="filter-input" value={filters.dataFim} onChange={handleFilterChange} />
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="kpi-grid" style={{ marginBottom: '24px' }}>
          <div className="kpi-card">
            <div className="kpi-header">
              <span>Total de Receitas</span>
            </div>
            <div className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`} style={{ color: 'var(--success)' }}>
              {formatCurrency(summary.receitas)}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span>Total de Despesas</span>
            </div>
            <div className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`} style={{ color: 'var(--danger)' }}>
              - {formatCurrency(summary.despesas)}
            </div>
          </div>

          <div className="kpi-card accent">
            <div className="kpi-header">
              <span>Saldo Liquido (Período)</span>
            </div>
            <div className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`} style={{ color: summary.saldo >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
              {formatCurrency(summary.saldo)}
            </div>
          </div>
        </div>

        {loading ? (
           <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Carregando dados do relatório...</p>
        ) : transacoes.length === 0 ? (
           <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Nenhuma transação efetivada encontrada neste período para compor o relatório.</p>
        ) : (
          <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            
            {/* Bar Chart Container */}
            <div className="kpi-card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>Evolução Diária</h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataPorData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.2} vertical={false}/>
                    <XAxis dataKey="name" stroke={axisColor} fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: '8px', color: axisColor }} 
                      itemStyle={{ fontWeight: 600 }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }}/>
                    <Bar dataKey="Receitas" fill="#2eb85c" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#e55353" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart Container */}
            <div className="kpi-card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>Despesas por Categoria</h3>
              <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {chartDataPorCategoria.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartDataPorCategoria}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {chartDataPorCategoria.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: '8px', color: axisColor }}
                        formatter={(value) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    Sem dados de despesas.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  )
}

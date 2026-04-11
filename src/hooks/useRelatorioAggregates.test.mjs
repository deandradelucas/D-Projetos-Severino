import { describe, it, expect } from 'vitest'
import { computeRelatorioAggregates } from './useRelatorioAggregates.js'

describe('computeRelatorioAggregates', () => {
  it('retorna zeros para lista vazia ou ausente', () => {
    expect(computeRelatorioAggregates([]).summary).toEqual({ receitas: 0, despesas: 0, saldo: 0 })
    expect(computeRelatorioAggregates(null).chartDataPorMes).toEqual([])
    expect(computeRelatorioAggregates(undefined).totalComprasRecorrentesPeriodo).toBe(0)
  })

  it('ignora transação sem data válida', () => {
    const r = computeRelatorioAggregates([
      { tipo: 'RECEITA', valor: 100, data_transacao: 'invalid' },
      { tipo: 'DESPESA', valor: 50, data_transacao: '' },
    ])
    expect(r.summary.receitas).toBe(0)
    expect(r.summary.despesas).toBe(0)
    expect(r.chartDataPorMes).toEqual([])
  })

  it('agrega receitas, despesas, saldo e séries mensais', () => {
    const r = computeRelatorioAggregates([
      {
        tipo: 'receita',
        valor: 200,
        data_transacao: '2025-01-10',
        categorias: { nome: 'Salário' },
      },
      {
        tipo: 'DESPESA',
        valor: '80,50',
        data_transacao: '2025-01-15T12:00:00',
        categorias: { nome: 'Mercado' },
      },
      {
        tipo: 'DESPESA',
        valor: 20,
        data_transacao: '2025-02-01',
        categorias: null,
        recorrencia_mensal_id: 'x',
      },
    ])
    expect(r.summary.receitas).toBe(200)
    expect(r.summary.despesas).toBeCloseTo(100.5, 5)
    expect(r.summary.saldo).toBeCloseTo(99.5, 5)
    expect(r.chartDataPorMes).toHaveLength(2)
    expect(r.chartDataPorMes[0].Receitas).toBe(200)
    expect(r.chartDataPorMes[0].Despesas).toBeCloseTo(80.5, 5)
    expect(r.chartDataComprasRecorrentesMes.some((row) => row.total === 20)).toBe(true)
    expect(r.totalComprasRecorrentesPeriodo).toBe(20)
    expect(r.chartDataPorCategoria[0].name).toBe('Mercado')
    expect(r.chartDataReceitasPorCategoria[0].name).toBe('Salário')
  })

  it('soma parcela recorrente por recorrente_index', () => {
    const r = computeRelatorioAggregates([
      {
        tipo: 'DESPESA',
        valor: 10,
        data_transacao: '2025-03-01',
        recorrente_index: 1,
      },
    ])
    expect(r.totalComprasRecorrentesPeriodo).toBe(10)
  })
})

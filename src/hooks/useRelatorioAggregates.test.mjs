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

  it('projeta recorrência ativa em meses sem lançamento real (Prazo indeterminado)', () => {
    const recorrenciasAtivas = [
      {
        id: 'reg-netflix',
        tipo: 'DESPESA',
        valor: 59.9,
        ativo: true,
        mes_inicio: '2025-05',
        total_meses: null,
      },
    ]
    const transacoes = [
      // Já lançada em maio (cron rodou): NÃO deve duplicar com a projeção
      {
        tipo: 'DESPESA',
        valor: 59.9,
        data_transacao: '2025-05-01',
        recorrencia_mensal_id: 'reg-netflix',
      },
    ]
    const r = computeRelatorioAggregates(transacoes, {
      recorrenciasAtivas,
      periodoMeses: ['2025-05', '2025-06', '2025-07'],
    })

    expect(r.chartDataComprasRecorrentesMes).toHaveLength(3)
    // Maio: vem da transação real
    expect(r.chartDataComprasRecorrentesMes[0].total).toBeCloseTo(59.9, 5)
    // Junho/Julho: projetados a partir da regra ativa
    expect(r.chartDataComprasRecorrentesMes[1].total).toBeCloseTo(59.9, 5)
    expect(r.chartDataComprasRecorrentesMes[2].total).toBeCloseTo(59.9, 5)
    expect(r.totalComprasRecorrentesPeriodo).toBeCloseTo(179.7, 5)
  })

  it('respeita mes_inicio e total_meses ao projetar', () => {
    const r = computeRelatorioAggregates([], {
      recorrenciasAtivas: [
        {
          id: 'reg-finita',
          tipo: 'DESPESA',
          valor: 100,
          ativo: true,
          mes_inicio: '2025-06',
          total_meses: 2, // 2 meses contados a partir de junho → jun + jul
        },
      ],
      periodoMeses: ['2025-05', '2025-06', '2025-07', '2025-08'],
    })
    const totaisPorMes = Object.fromEntries(
      r.chartDataComprasRecorrentesMes.map((row) => [row.name, row.total])
    )
    expect(totaisPorMes['mai. de 2025']).toBe(0) // antes de mes_inicio
    expect(totaisPorMes['jun. de 2025']).toBe(100)
    expect(totaisPorMes['jul. de 2025']).toBe(100)
    expect(totaisPorMes['ago. de 2025']).toBe(0) // após total_meses
    expect(r.totalComprasRecorrentesPeriodo).toBe(200)
  })

  it('ignora regras inativas/de receita ou com valor inválido', () => {
    const r = computeRelatorioAggregates([], {
      recorrenciasAtivas: [
        { id: 'a', tipo: 'RECEITA', valor: 100 }, // receita: ignorada
        { id: 'b', tipo: 'DESPESA', valor: 0 }, // valor zero: ignorado
        { id: 'c', tipo: 'DESPESA', valor: 'abc' }, // inválido: ignorado
      ],
      periodoMeses: ['2025-05', '2025-06'],
    })
    expect(r.totalComprasRecorrentesPeriodo).toBe(0)
  })
})

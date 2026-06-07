import { describe, it, expect } from 'vitest'
import {
  computePrevRange,
  pctDelta,
  computeSaldoAcumulado,
  computeTop5Despesas,
  computeOrcadoVsReal,
  computeFixoVsVariavel,
  computeVariacaoCategorias,
} from './relatoriosDerived.js'

describe('computePrevRange', () => {
  it('período anterior de mesmo tamanho imediatamente antes', () => {
    // 10 dias (01–10/mar) → 10 dias anteriores: 19–28/fev
    expect(computePrevRange({ dataInicio: '2026-03-01', dataFim: '2026-03-10' }))
      .toEqual({ dataInicio: '2026-02-19', dataFim: '2026-02-28' })
  })
  it('1 dia → 1 dia anterior', () => {
    expect(computePrevRange({ dataInicio: '2026-03-05', dataFim: '2026-03-05' }))
      .toEqual({ dataInicio: '2026-03-04', dataFim: '2026-03-04' })
  })
  it('null quando filtro incompleto', () => {
    expect(computePrevRange({ dataInicio: '', dataFim: '2026-03-10' })).toBeNull()
    expect(computePrevRange({})).toBeNull()
  })
})

describe('pctDelta', () => {
  it('calcula variação percentual', () => {
    expect(pctDelta(150, 100)).toBe(50)
    expect(pctDelta(50, 100)).toBe(-50)
  })
  it('null quando prev é 0 ou nulo', () => {
    expect(pctDelta(100, 0)).toBeNull()
    expect(pctDelta(100, null)).toBeNull()
  })
  it('usa módulo do prev (prev negativo)', () => {
    expect(pctDelta(0, -100)).toBe(100)
  })
})

describe('computeSaldoAcumulado', () => {
  it('acumula receitas - despesas mês a mês', () => {
    const r = computeSaldoAcumulado([
      { name: 'Jan', Receitas: 100, Despesas: 40 },
      { name: 'Fev', Receitas: 50, Despesas: 80 },
    ])
    expect(r).toEqual([
      { name: 'Jan', Saldo: 60 },
      { name: 'Fev', Saldo: 30 },
    ])
  })
})

describe('computeTop5Despesas', () => {
  it('filtra despesas, ordena desc e limita a 5', () => {
    const txs = [
      { id: 1, tipo: 'DESPESA', valor: 30, descricao: 'A', data_transacao: '2026-03-01' },
      { id: 2, tipo: 'RECEITA', valor: 999, descricao: 'Salário', data_transacao: '2026-03-02' },
      { id: 3, tipo: 'DESPESA', valor: 100, descricao: 'B', data_transacao: '2026-03-03' },
      { id: 4, tipo: 'despesa', valor: 50, categorias: { nome: 'Mercado' }, data_transacao: '2026-03-04' },
    ]
    const r = computeTop5Despesas(txs)
    expect(r.map((x) => x.id)).toEqual([3, 4, 1])
    expect(r[1]).toMatchObject({ desc: 'Mercado', cat: 'Mercado', valor: 50 })
  })
  it('lista vazia / nula', () => {
    expect(computeTop5Despesas(null)).toEqual([])
  })
})

describe('computeOrcadoVsReal', () => {
  const categorias = [{ id: 1, nome: 'Mercado' }, { id: 2, nome: 'Lazer' }]
  const chart = [{ name: 'Mercado', value: 600 }, { name: 'Lazer', value: 100 }]
  it('compara gasto x limite, marca excedido e ordena por gasto', () => {
    const limites = [
      { categoria_id: 1, limite_mensal: 500 },
      { categoria_id: 2, limite_mensal: 300 },
    ]
    const r = computeOrcadoVsReal(limites, categorias, chart)
    expect(r.map((x) => x.nome)).toEqual(['Mercado', 'Lazer'])
    expect(r[0]).toMatchObject({ limite: 500, gasto: 600, pct: 100, excedido: true })
    expect(r[1]).toMatchObject({ limite: 300, gasto: 100, pct: 33, excedido: false })
  })
  it('ignora limite <= 0 e categoria inexistente', () => {
    const r = computeOrcadoVsReal([{ categoria_id: 1, limite_mensal: 0 }, { categoria_id: 9, limite_mensal: 100 }], categorias, chart)
    expect(r).toEqual([])
  })
  it('sem limites → vazio', () => {
    expect(computeOrcadoVsReal([], categorias, chart)).toEqual([])
  })
})

describe('computeFixoVsVariavel', () => {
  it('separa fixo (recorrente/parcelado) de variável e calcula comprometimento', () => {
    const txs = [
      { tipo: 'DESPESA', valor: 1000, recorrencia_mensal_id: 'm1' }, // fixo
      { tipo: 'DESPESA', valor: 500, recorrente_index: 2 },           // fixo (parcela)
      { tipo: 'DESPESA', valor: 500 },                                // variável
      { tipo: 'RECEITA', valor: 9999 },                               // ignorado
    ]
    const r = computeFixoVsVariavel(txs, 5000)
    expect(r.fixo).toBe(1500)
    expect(r.variavel).toBe(500)
    expect(r.total).toBe(2000)
    expect(r.pctFixo).toBe(75)
    expect(r.comprometimento).toBe(30) // 1500/5000
  })
  it('comprometimento null quando receita 0', () => {
    expect(computeFixoVsVariavel([{ tipo: 'DESPESA', valor: 100 }], 0).comprometimento).toBeNull()
  })
})

describe('computeVariacaoCategorias', () => {
  const prev = [{ name: 'Mercado', value: 200 }, { name: 'Lazer', value: 50 }]
  const cur = [{ name: 'Mercado', value: 300 }, { name: 'Lazer', value: 50 }]
  it('calcula diff/pct e ordena por |diff| desc, ignorando diffs < 1', () => {
    const r = computeVariacaoCategorias(prev, cur, null)
    // Lazer (diff 0) é ignorado; Mercado diff +100
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ name: 'Mercado', cur: 300, prev: 200, diff: 100, pct: 50 })
  })
  it('vazio quando há filtro de categoria', () => {
    expect(computeVariacaoCategorias(prev, cur, '7')).toEqual([])
  })
  it('vazio quando não há período anterior', () => {
    expect(computeVariacaoCategorias(null, cur, null)).toEqual([])
  })
  it('pct null quando prev é 0 (categoria nova)', () => {
    const r = computeVariacaoCategorias([], [{ name: 'Novo', value: 80 }], null)
    expect(r[0]).toMatchObject({ name: 'Novo', prev: 0, diff: 80, pct: null })
  })
})

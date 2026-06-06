import { describe, it, expect } from 'vitest'
import {
  transacaoDiaKey,
  transacaoMesKey,
  parseValorTransacao,
  isDespesaRecorrente,
  transacaoDescricaoEfetiva,
} from './transacaoUtils.js'

describe('transacaoUtils', () => {
  it('transacaoDiaKey extrai YYYY-MM-DD', () => {
    expect(transacaoDiaKey('2026-04-09T12:00:00.000Z')).toBe('2026-04-09')
    expect(transacaoDiaKey('')).toBe('')
  })

  it('transacaoDiaKey: data-only passa direto (sem conversão de fuso)', () => {
    expect(transacaoDiaKey('2026-06-05')).toBe('2026-06-05')
    expect(transacaoDiaKey('2026-06-05T00:00:00')).not.toBe('') // timestamp vira data local
  })

  it('transacaoMesKey retorna YYYY-MM', () => {
    expect(transacaoMesKey('2026-04-09')).toBe('2026-04')
  })

  it('parseValorTransacao aceita número e string', () => {
    expect(parseValorTransacao({ valor: 10.5 })).toBe(10.5)
    expect(parseValorTransacao({ valor: '10,5' })).toBe(10.5)
  })

  it('transacaoDescricaoEfetiva ignora cópia de sub/categoria', () => {
    expect(
      transacaoDescricaoEfetiva({
        descricao: 'Mercado',
        categorias: { nome: 'Alimentação' },
        subcategorias: { nome: 'Supermercado' },
      })
    ).toBe('Mercado')
    expect(
      transacaoDescricaoEfetiva({
        descricao: 'Supermercado',
        categorias: { nome: 'Alimentação' },
        subcategorias: { nome: 'Supermercado' },
      })
    ).toBe('')
    expect(
      transacaoDescricaoEfetiva({
        descricao: 'Alimentação',
        categorias: { nome: 'Alimentação' },
        subcategorias: null,
      })
    ).toBe('')
    expect(transacaoDescricaoEfetiva({ descricao: '  ' })).toBe('')
  })

  it('isDespesaRecorrente', () => {
    expect(
      isDespesaRecorrente({
        tipo: 'DESPESA',
        recorrencia_mensal_id: 'x',
      })
    ).toBe(true)
    expect(isDespesaRecorrente({ tipo: 'DESPESA' })).toBe(false)
    expect(isDespesaRecorrente({ tipo: 'RECEITA', recorrencia_mensal_id: 'x' })).toBe(false)
  })
})

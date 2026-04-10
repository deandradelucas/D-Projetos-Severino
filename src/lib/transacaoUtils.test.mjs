import { describe, it, expect } from 'vitest'
import {
  transacaoDiaKey,
  transacaoMesKey,
  parseValorTransacao,
  isDespesaRecorrente,
} from './transacaoUtils.js'

describe('transacaoUtils', () => {
  it('transacaoDiaKey extrai YYYY-MM-DD', () => {
    expect(transacaoDiaKey('2026-04-09T12:00:00.000Z')).toBe('2026-04-09')
    expect(transacaoDiaKey('')).toBe('')
  })

  it('transacaoMesKey retorna YYYY-MM', () => {
    expect(transacaoMesKey('2026-04-09')).toBe('2026-04')
  })

  it('parseValorTransacao aceita número e string', () => {
    expect(parseValorTransacao({ valor: 10.5 })).toBe(10.5)
    expect(parseValorTransacao({ valor: '10,5' })).toBe(10.5)
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

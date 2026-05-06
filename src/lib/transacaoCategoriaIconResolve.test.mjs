import { describe, expect, it } from 'vitest'
import { getTransacaoCategoriaIconKey } from './transacaoCategoriaIconResolve.js'

describe('getTransacaoCategoriaIconKey', () => {
  it('combustível na subcategoria → fuel', () => {
    expect(getTransacaoCategoriaIconKey('Transporte', 'Combustível')).toBe('fuel')
  })

  it('Alimentação + Restaurantes → utensils', () => {
    expect(getTransacaoCategoriaIconKey('Alimentação', 'Restaurantes e Lanches')).toBe('utensils')
  })

  it('nome exato categoria Transporte → car', () => {
    expect(getTransacaoCategoriaIconKey('Transporte', '—')).toBe('car')
  })

  it('sem match → null', () => {
    expect(getTransacaoCategoriaIconKey('Xyz Desconhecida', 'Foo')).toBe(null)
  })
})

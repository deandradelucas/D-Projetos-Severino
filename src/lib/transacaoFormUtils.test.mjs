import { describe, it, expect } from 'vitest'
import { tipoCategoriaIgual, filtrarCategoriasPorTipo, safeEvalExpression } from './transacaoFormUtils.js'

describe('tipoCategoriaIgual', () => {
  it('compara ignorando caixa e espaços', () => {
    expect(tipoCategoriaIgual('despesa', 'DESPESA')).toBe(true)
    expect(tipoCategoriaIgual('  Receita ', 'RECEITA')).toBe(true)
    expect(tipoCategoriaIgual('DESPESA', 'RECEITA')).toBe(false)
  })
  it('trata null/undefined', () => {
    expect(tipoCategoriaIgual(null, '')).toBe(true)
    expect(tipoCategoriaIgual(undefined, 'DESPESA')).toBe(false)
  })
})

describe('filtrarCategoriasPorTipo', () => {
  const cats = [
    { nome: 'Mercado', tipo: 'DESPESA' },
    { nome: 'Salário', tipo: 'RECEITA' },
    { nome: 'Aluguel', tipo: 'despesa' },
    { nome: 'água', tipo: 'DESPESA' },
  ]
  it('filtra por tipo e ordena por nome (pt, base — acentos juntos)', () => {
    const r = filtrarCategoriasPorTipo(cats, 'DESPESA')
    expect(r.map((c) => c.nome)).toEqual(['água', 'Aluguel', 'Mercado'])
  })
  it('não muta o array original', () => {
    const orig = [...cats]
    filtrarCategoriasPorTipo(cats, 'DESPESA')
    expect(cats).toEqual(orig)
  })
})

describe('safeEvalExpression', () => {
  it('avalia aritmética básica e arredonda 2 casas', () => {
    expect(safeEvalExpression('2+2')).toBe(4)
    expect(safeEvalExpression('10/3')).toBe(3.33)
    expect(safeEvalExpression('(1+2)*3')).toBe(9)
  })
  it('normaliza símbolos e vírgula BR', () => {
    expect(safeEvalExpression('2×3')).toBe(6)
    expect(safeEvalExpression('10÷4')).toBe(2.5)
    expect(safeEvalExpression('5−1')).toBe(4)
    expect(safeEvalExpression('1,5+1,5')).toBe(3)
  })
  it('rejeita caracteres não permitidos (anti-injeção)', () => {
    expect(safeEvalExpression('alert(1)')).toBeNull()
    expect(safeEvalExpression('1;process')).toBeNull()
    expect(safeEvalExpression('window.location')).toBeNull()
  })
  it('null para resultado não-finito ou inválido', () => {
    expect(safeEvalExpression('1/0')).toBeNull()
    expect(safeEvalExpression('()')).toBeNull()
    expect(safeEvalExpression('')).toBeNull()
  })
})

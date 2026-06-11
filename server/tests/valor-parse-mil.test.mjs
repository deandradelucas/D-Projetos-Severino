import { describe, expect, it } from 'vitest'
import {
  parseBRVerbalValor,
  extrairValorBasicoFromTexto,
} from '../lib/domain/transaction-heuristics.mjs'

// Regressão: "21 mil" virava 21 (e "21.000,00" funcionava). O multiplicador
// "mil" precisa valer mesmo após dígito. Fallback heurístico (IA fora do ar).
describe('extrairValorBasicoFromTexto — "mil" após dígito + formato BR', () => {
  const casos = [
    ['21 mil', 21000],
    ['5 mil', 5000],
    ['21 mil reais', 21000],
    ['1,5 mil', 1500],
    ['1.5 mil', 1500],
    ['21.5 mil', 21500],
    ['2 mil e 500', 2500],
    ['gastei 21 mil no carro', 21000],
    ['vinte e um mil', 21000],
    ['dois mil e quinhentos', 2500],
    ['21.000,00', 21000],
    ['R$ 2.000', 2000],
    ['1.500,50', 1500.5],
    ['recebi 1500', 1500],
    ['cinquenta reais', 50],
  ]
  for (const [texto, esperado] of casos) {
    it(`"${texto}" → ${esperado}`, () => {
      expect(extrairValorBasicoFromTexto(texto)).toBe(esperado)
    })
  }

  it('não dá falso positivo em "um café" / "dois pratos"', () => {
    expect(parseBRVerbalValor('um café')).toBeNull()
    expect(parseBRVerbalValor('dois pratos')).toBeNull()
  })
})

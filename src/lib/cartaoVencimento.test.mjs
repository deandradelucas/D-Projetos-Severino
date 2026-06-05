import { describe, it, expect } from 'vitest'
import { vencimentoCartaoParaData, calcularParcelaAtual } from './cartaoVencimento.js'

describe('vencimentoCartaoParaData', () => {
  // Regra: 1ª parcela = próximo dia de vencimento >= data da compra.
  it('compra depois do dia de vencimento → próximo mês (caso do CEO: 17/04, vence 10 → 10/05)', () => {
    expect(vencimentoCartaoParaData('2026-04-17', 10)).toBe('2026-05-10')
  })

  it('compra antes do dia de vencimento no mês → mesmo mês', () => {
    expect(vencimentoCartaoParaData('2026-04-05', 10)).toBe('2026-04-10')
  })

  it('compra no próprio dia do vencimento → mesmo dia', () => {
    expect(vencimentoCartaoParaData('2026-04-10', 10)).toBe('2026-04-10')
  })

  it('aceita datetime-local', () => {
    expect(vencimentoCartaoParaData('2026-04-17T16:29', 10)).toBe('2026-05-10')
  })

  it('parcelas seguintes somam meses (índice da parcela)', () => {
    expect(vencimentoCartaoParaData('2026-04-17', 10, 1)).toBe('2026-06-10')
    expect(vencimentoCartaoParaData('2026-04-17', 10, 2)).toBe('2026-07-10')
  })

  it('clamp de dia em mês curto (vence 31 em fevereiro)', () => {
    expect(vencimentoCartaoParaData('2026-01-15', 31, 1)).toBe('2026-02-28')
  })

  it('entrada inválida → string vazia', () => {
    expect(vencimentoCartaoParaData('2026-04-17', null)).toBe('')
    expect(vencimentoCartaoParaData('', 10)).toBe('')
  })
})

describe('calcularParcelaAtual', () => {
  // Caso do CEO: compra 17/04, vence dia 10 → 1ª parcela 10/05.
  it('1ª parcela já venceu (hoje 04/06) → parcela 2/10, próxima 10/06', () => {
    expect(calcularParcelaAtual('2026-04-17', 10, 10, '2026-06-04'))
      .toEqual({ parcelaInicial: 2, dataPagamento: '2026-06-10' })
  })

  it('antes da 1ª vencer → parcela 1', () => {
    expect(calcularParcelaAtual('2026-04-17', 10, 10, '2026-05-09'))
      .toEqual({ parcelaInicial: 1, dataPagamento: '2026-05-10' })
  })

  it('no dia do vencimento da 1ª → ainda parcela 1 (não conta como paga)', () => {
    expect(calcularParcelaAtual('2026-04-17', 10, 10, '2026-05-10'))
      .toEqual({ parcelaInicial: 1, dataPagamento: '2026-05-10' })
  })

  it('duas parcelas já passaram (hoje 11/07) → parcela 3', () => {
    // vencimentos: 10/05, 10/06, 10/07, ... em 11/07 já passaram 10/05, 10/06, 10/07
    expect(calcularParcelaAtual('2026-04-17', 10, 10, '2026-07-11'))
      .toEqual({ parcelaInicial: 4, dataPagamento: '2026-08-10' })
  })

  it('compra recente, nada vencido → parcela 1', () => {
    expect(calcularParcelaAtual('2026-06-03', 10, 10, '2026-06-04'))
      .toEqual({ parcelaInicial: 1, dataPagamento: '2026-06-10' })
  })

  it('todas as parcelas vencidas → limita à última', () => {
    const r = calcularParcelaAtual('2025-01-05', 10, 3, '2026-06-04')
    expect(r.parcelaInicial).toBe(3)
  })

  it('sem cartão válido → parcela 1 sem data', () => {
    expect(calcularParcelaAtual('2026-04-17', null, 10, '2026-06-04'))
      .toEqual({ parcelaInicial: 1, dataPagamento: '' })
  })
})

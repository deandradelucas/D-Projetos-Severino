import { afterEach, describe, expect, it, vi } from 'vitest'
import { contarDiasUteis, aliquotaIr, calcularRendimentoInvestimento } from '../lib/investimentos-rendimento.mjs'

describe('contarDiasUteis (server)', () => {
  it('NÃO conta o dia da aquisição (CDI rende a partir do D+1 útil)', () => {
    // 08/jan/2024 é segunda; semana sem feriado. Aquisição na seg, ref na sex.
    // D+1 = ter 09 → conta ter, qua, qui, sex = 4 (se contasse D0 seriam 5).
    expect(contarDiasUteis('2024-01-08', new Date(2024, 0, 12))).toBe(4)
  })

  it('retorna 0 quando a referência é o próprio dia da aquisição', () => {
    expect(contarDiasUteis('2024-01-08', new Date(2024, 0, 8))).toBe(0)
  })

  it('em 2020 (antes da Lei 14.759/2023) 20/nov é dia útil com pregão', () => {
    // 17/nov/2020 (ter) → D+1 qua 18; conta qua 18, qui 19, sex 20 = 3.
    expect(contarDiasUteis('2020-11-17', new Date(2020, 10, 20))).toBe(3)
  })

  it('a partir de 2023 Consciência Negra (20/nov) é feriado e não conta', () => {
    // 18/nov/2024 (seg) → D+1 ter 19; qua 20 é feriado → conta só ter 19 = 1.
    expect(contarDiasUteis('2024-11-18', new Date(2024, 10, 20))).toBe(1)
  })
})

describe('aliquotaIr (IR regressivo)', () => {
  it('faixas regressivas por dias corridos', () => {
    expect(aliquotaIr(100)).toBe(0.225)
    expect(aliquotaIr(200)).toBe(0.2)
    expect(aliquotaIr(500)).toBe(0.175)
    expect(aliquotaIr(800)).toBe(0.15)
  })
})

describe('calcularRendimentoInvestimento — múltiplos aportes', () => {
  afterEach(() => vi.useRealTimers())

  it('alíquota é a EFETIVA ponderada (não a do último aporte)', () => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    const inv = {
      percentual_cdi: 100,
      tipo_indexador: 'CDI',
      tipo_preset: 'CDB', // não isento
      aportes: [
        { valor: 1000, data_aquisicao: '2015-01-02' }, // >720 dias → 15%
        { valor: 1000, data_aquisicao: '2026-05-20' }, // ~26 dias → 22,5%
      ],
    }
    const r = calcularRendimentoInvestimento(inv, 12)
    // O imposto implícito pela alíquota retornada bate com (bruto - líquido) acumulados.
    expect(r.brutoAcum * r.aliquota).toBeCloseTo(r.brutoAcum - r.liquidoAcum, 8)
    // E fica ENTRE as duas faixas (15% e 22,5%) — prova que é ponderada, não a do último.
    expect(r.aliquota).toBeGreaterThan(0.15)
    expect(r.aliquota).toBeLessThan(0.225)
  })
})

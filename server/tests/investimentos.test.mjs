import { describe, expect, it, vi } from 'vitest'
import {
  INVESTIMENTO_PRESETS,
  parseDataAquisicao,
  parseInvestimentoCreateBody,
  parsePercentualCdi,
  parseValorInvestido,
} from '../lib/investimentos.mjs'

const BB = 'Banco do Brasil'
const V100 = 100
const P100 = 100
const DATA_PASS = '2022-06-15'

describe('investimentos.mjs — parseValorInvestido', () => {
  it('exige valor', () => {
    expect(() => parseValorInvestido(undefined)).toThrow(/valor investido/)
    expect(() => parseValorInvestido('')).toThrow(/valor investido/)
  })

  it('aceita número e texto pt-BR', () => {
    expect(parseValorInvestido(100.456)).toBe(100.46)
    expect(parseValorInvestido('1.234,56')).toBe(1234.56)
  })

  it('rejeita abaixo de 0,01', () => {
    expect(() => parseValorInvestido(0)).toThrow(/0,01/)
  })
})

describe('investimentos.mjs — parsePercentualCdi', () => {
  it('exige percentual', () => {
    expect(() => parsePercentualCdi(undefined)).toThrow(/CDI/)
    expect(() => parsePercentualCdi('')).toThrow(/CDI/)
  })

  it('aceita número e texto com %', () => {
    expect(parsePercentualCdi(110.456)).toBe(110.46)
    expect(parsePercentualCdi('110,5 %')).toBe(110.5)
  })

  it('rejeita abaixo de 0,01', () => {
    expect(() => parsePercentualCdi(0)).toThrow(/0,01/)
  })
})

describe('investimentos.mjs — parseDataAquisicao', () => {
  it('exige data', () => {
    expect(() => parseDataAquisicao(undefined)).toThrow(/aquisição/)
    expect(() => parseDataAquisicao('')).toThrow(/aquisição/)
  })

  it('aceita YYYY-MM-DD', () => {
    expect(parseDataAquisicao('2020-01-02')).toBe('2020-01-02')
  })

  it('rejeita data inválida', () => {
    expect(() => parseDataAquisicao('2020-13-40')).toThrow(/inválida/)
    expect(() => parseDataAquisicao('não')).toThrow(/inválida/)
  })

  it('rejeita data futura', () => {
    const far = new Date()
    far.setFullYear(far.getFullYear() + 2)
    const y = far.getFullYear()
    const m = String(far.getMonth() + 1).padStart(2, '0')
    const d = String(far.getDate()).padStart(2, '0')
    expect(() => parseDataAquisicao(`${y}-${m}-${d}`)).toThrow(/futuro/)
  })
})

describe('investimentos.mjs — parseInvestimentoCreateBody', () => {
  it('exige instituição', () => {
    expect(() =>
      parseInvestimentoCreateBody({
        preset: 'lca',
        valor_investido: V100,
        percentual_cdi: P100,
        data_aquisicao: DATA_PASS,
      }),
    ).toThrow(/banco/)
  })

  it('exige valor investido', () => {
    expect(() =>
      parseInvestimentoCreateBody({ preset: 'lca', instituicao_nome: BB, percentual_cdi: P100, data_aquisicao: DATA_PASS }),
    ).toThrow(/valor investido/)
  })

  it('exige percentual CDI', () => {
    expect(() =>
      parseInvestimentoCreateBody({ preset: 'lca', instituicao_nome: BB, valor_investido: V100, data_aquisicao: DATA_PASS }),
    ).toThrow(/CDI/)
  })

  it('exige data de aquisição (PATCH / modo estrito)', () => {
    expect(() =>
      parseInvestimentoCreateBody({ preset: 'lca', instituicao_nome: BB, valor_investido: V100, percentual_cdi: P100 }),
    ).toThrow(/aquisição/)
  })

  it('POST: usa hoje quando data de aquisição omitida', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T12:00:00'))
    try {
      const r = parseInvestimentoCreateBody(
        { preset: 'lca', instituicao_nome: BB, valor_investido: V100, percentual_cdi: P100 },
        { defaultDataAquisicaoHoje: true },
      )
      expect(r.data_aquisicao).toBe('2026-05-09')
    } finally {
      vi.useRealTimers()
    }
  })

  it('aceita preset LCA com instituição', () => {
    const r = parseInvestimentoCreateBody({
      preset: 'lca',
      instituicao_nome: BB,
      valor_investido: V100,
      percentual_cdi: P100,
      data_aquisicao: DATA_PASS,
    })
    expect(r).toEqual({
      tipo_preset: 'LCA',
      nome: INVESTIMENTO_PRESETS.LCA,
      instituicao_nome: BB,
      valor_investido: 100,
      percentual_cdi: 100,
      data_aquisicao: DATA_PASS,
    })
  })

  it('aceita nome_custom quando sem preset válido', () => {
    const r = parseInvestimentoCreateBody({
      nome_custom: '  Tesouro IPCA+  ',
      instituicao_nome: ' XP ',
      valor_investido: 50.25,
      percentual_cdi: '105%',
      data_aquisicao: DATA_PASS,
    })
    expect(r).toEqual({
      tipo_preset: null,
      nome: 'Tesouro IPCA+',
      instituicao_nome: 'XP',
      valor_investido: 50.25,
      percentual_cdi: 105,
      data_aquisicao: DATA_PASS,
    })
  })

  it('rejeita custom curto (tipo)', () => {
    expect(() =>
      parseInvestimentoCreateBody({
        nome_custom: 'x',
        instituicao_nome: BB,
        valor_investido: 1,
        percentual_cdi: 100,
        data_aquisicao: DATA_PASS,
      }),
    ).toThrow(/investimento/)
  })

  it('rejeita sem preset nem custom válido', () => {
    expect(() =>
      parseInvestimentoCreateBody({
        preset: '',
        nome_custom: '',
        instituicao_nome: BB,
        valor_investido: 1,
        percentual_cdi: 100,
        data_aquisicao: DATA_PASS,
      }),
    ).toThrow(/lista/)
  })
})

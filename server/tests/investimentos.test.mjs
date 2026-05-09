import { describe, expect, it } from 'vitest'
import { INVESTIMENTO_PRESETS, parseInvestimentoCreateBody } from '../lib/investimentos.mjs'

const BB = 'Banco do Brasil'

describe('investimentos.mjs — parseInvestimentoCreateBody', () => {
  it('exige instituição', () => {
    expect(() => parseInvestimentoCreateBody({ preset: 'lca' })).toThrow(/banco/)
  })

  it('aceita preset LCA com instituição', () => {
    const r = parseInvestimentoCreateBody({ preset: 'lca', instituicao_nome: BB })
    expect(r).toEqual({
      tipo_preset: 'LCA',
      nome: INVESTIMENTO_PRESETS.LCA,
      instituicao_nome: BB,
    })
  })

  it('aceita nome_custom quando sem preset válido', () => {
    const r = parseInvestimentoCreateBody({
      nome_custom: '  Tesouro IPCA+  ',
      instituicao_nome: ' XP ',
    })
    expect(r).toEqual({ tipo_preset: null, nome: 'Tesouro IPCA+', instituicao_nome: 'XP' })
  })

  it('rejeita custom curto (tipo)', () => {
    expect(() =>
      parseInvestimentoCreateBody({ nome_custom: 'x', instituicao_nome: BB }),
    ).toThrow(/investimento/)
  })

  it('rejeita sem preset nem custom válido', () => {
    expect(() => parseInvestimentoCreateBody({ preset: '', nome_custom: '', instituicao_nome: BB })).toThrow(/lista/)
  })
})

import { describe, it, expect } from 'vitest'
import { normalizeTipoCategoria } from '../lib/transacoes.mjs'

describe('normalizeTipoCategoria', () => {
  it('aceita RECEITA e DESPESA com espaços e caixa mista', () => {
    expect(normalizeTipoCategoria(' receita ')).toBe('RECEITA')
    expect(normalizeTipoCategoria('DESPESA')).toBe('DESPESA')
  })

  it('valor vazio ou inválido vira DESPESA', () => {
    expect(normalizeTipoCategoria('')).toBe('DESPESA')
    expect(normalizeTipoCategoria(null)).toBe('DESPESA')
    expect(normalizeTipoCategoria(undefined)).toBe('DESPESA')
  })

  it('preserva outros tokens em maiúsculas (não RECEITA/DESPESA)', () => {
    expect(normalizeTipoCategoria('OUTRO')).toBe('OUTRO')
  })
})

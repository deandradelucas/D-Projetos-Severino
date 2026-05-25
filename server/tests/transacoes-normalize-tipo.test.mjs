import { describe, it, expect } from 'vitest'
import { normalizeTipoCategoria } from '../lib/transacoes.mjs'

describe('normalizeTipoCategoria', () => {
  it('aceita RECEITA e DESPESA em qualquer caixa', () => {
    expect(normalizeTipoCategoria('receita')).toBe('RECEITA')
    expect(normalizeTipoCategoria('DESPESA')).toBe('DESPESA')
  })

  it('limpa espaços em volta', () => {
    expect(normalizeTipoCategoria(' receita ')).toBe('RECEITA')
    expect(normalizeTipoCategoria('  DESPESA  ')).toBe('DESPESA')
  })

  it('valor vazio ou inválido vira DESPESA', () => {
    expect(normalizeTipoCategoria('')).toBe('DESPESA')
    expect(normalizeTipoCategoria(null)).toBe('DESPESA')
    expect(normalizeTipoCategoria(undefined)).toBe('DESPESA')
  })

  it('preserva outros tokens em maiúsculas (não RECEITA/DESPESA)', () => {
    expect(normalizeTipoCategoria('outro')).toBe('OUTRO')
    expect(normalizeTipoCategoria('OUTRO')).toBe('OUTRO')
  })
})

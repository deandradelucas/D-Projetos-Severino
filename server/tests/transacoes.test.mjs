import { describe, it, expect } from 'vitest'
import { normalizeTipoCategoria } from '../lib/transacoes.mjs'

describe('transacoes.mjs - normalizeTipoCategoria', () => {
  it('deve normalizar "receita" para "RECEITA"', () => {
    expect(normalizeTipoCategoria('receita')).toBe('RECEITA')
  })

  it('deve normalizar "despesa" para "DESPESA"', () => {
    expect(normalizeTipoCategoria('despesa')).toBe('DESPESA')
  })

  it('deve retornar "DESPESA" para valores nulos ou vazios', () => {
    expect(normalizeTipoCategoria(null)).toBe('DESPESA')
    expect(normalizeTipoCategoria(undefined)).toBe('DESPESA')
    expect(normalizeTipoCategoria('')).toBe('DESPESA')
  })

  it('deve limpar espaços em branco', () => {
    expect(normalizeTipoCategoria('  receita  ')).toBe('RECEITA')
  })

  it('deve retornar o valor em maiúsculas se não for RECEITA/DESPESA mas tiver conteúdo', () => {
    // Nota: O código atual retorna u.length ? u : 'DESPESA'
    expect(normalizeTipoCategoria('outro')).toBe('OUTRO')
  })
})

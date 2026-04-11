import { describe, it, expect } from 'vitest'
import { primeiroNomeExibicao } from './primeiroNomeExibicao.js'

describe('primeiroNomeExibicao', () => {
  it('usa nome e primeiro token', () => {
    expect(primeiroNomeExibicao({ nome: 'Maria Silva' })).toBe('Maria')
  })

  it('aceita legado usuario', () => {
    expect(primeiroNomeExibicao({ usuario: 'João' })).toBe('João')
  })

  it('fallback quando vazio', () => {
    expect(primeiroNomeExibicao({})).toBe('usuário')
    expect(primeiroNomeExibicao(null)).toBe('usuário')
  })
})

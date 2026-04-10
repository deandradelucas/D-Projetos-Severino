import { describe, it, expect } from 'vitest'
import {
  validateNovaTransacaoBody,
  validateAtualizacaoTransacaoBody,
  validateTransacoesListQuery,
  isUuidString,
} from '../lib/transacao-validate.mjs'

describe('transacao-validate', () => {
  it('isUuidString', () => {
    expect(isUuidString('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(isUuidString('not-a-uuid')).toBe(false)
  })

  it('validateNovaTransacaoBody aceita payload mínimo válido', () => {
    const r = validateNovaTransacaoBody({
      tipo: 'DESPESA',
      valor: 10.5,
      data_transacao: new Date().toISOString(),
      descricao: 'Teste',
    })
    expect(r.ok).toBe(true)
  })

  it('validateNovaTransacaoBody rejeita tipo inválido', () => {
    const r = validateNovaTransacaoBody({
      tipo: 'FOO',
      valor: 1,
      data_transacao: '2026-01-01T12:00:00.000Z',
    })
    expect(r.ok).toBe(false)
  })

  it('validateTransacoesListQuery limit', () => {
    expect(validateTransacoesListQuery({ limit: '500' }).ok).toBe(true)
    expect(validateTransacoesListQuery({ limit: '9999' }).ok).toBe(false)
  })

  it('validateAtualizacaoTransacaoBody', () => {
    const r = validateAtualizacaoTransacaoBody({
      tipo: 'RECEITA',
      valor: '100,50',
      data_transacao: '2026-04-01T00:00:00.000Z',
      descricao: 'x',
    })
    expect(r.ok).toBe(true)
  })
})

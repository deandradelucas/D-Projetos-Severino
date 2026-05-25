import { describe, it, expect } from 'vitest'
import { isMissingColumnError, rawIsentoPagamento } from '../lib/assinatura-db.mjs'

describe('isMissingColumnError', () => {
  it('retorna true quando code 42703 e mensagem cita a coluna alvo', () => {
    const err = { code: '42703', message: 'column "isento_pagamento" of relation "usuarios" does not exist' }
    expect(isMissingColumnError(err, 'isento_pagamento')).toBe(true)
  })

  it('retorna false para coluna diferente da que falta, mesmo com code 42703', () => {
    // Cenário real do bug: select pede stripe_subscription_status (que não existe)
    // e o código testa por isento_pagamento (que existe). Antes do fix, retornava
    // true para ambos por causa do code 42703.
    const err = { code: '42703', message: 'column usuarios.stripe_subscription_status does not exist' }
    expect(isMissingColumnError(err, 'isento_pagamento')).toBe(false)
    expect(isMissingColumnError(err, 'stripe_subscription_status')).toBe(true)
  })

  it('retorna true quando mensagem cita a coluna em português', () => {
    const err = { message: 'a coluna "trial_ends_at" não existe' }
    expect(isMissingColumnError(err, 'trial_ends_at')).toBe(true)
  })

  it('retorna false para erros que não são "missing column"', () => {
    const err = { code: '23505', message: 'duplicate key value violates unique constraint' }
    expect(isMissingColumnError(err, 'email')).toBe(false)
  })

  it('com column vazia, retorna true só se code é 42703', () => {
    expect(isMissingColumnError({ code: '42703', message: 'qualquer' }, '')).toBe(true)
    expect(isMissingColumnError({ code: '23505', message: 'qualquer' }, '')).toBe(false)
  })

  it('aceita err como string ou null sem explodir', () => {
    expect(isMissingColumnError(null, 'x')).toBe(false)
    expect(isMissingColumnError('not a real error', 'x')).toBe(false)
    expect(isMissingColumnError(undefined, '')).toBe(false)
  })
})

describe('rawIsentoPagamento', () => {
  it('aceita variações truthy do Postgres/PostgREST', () => {
    expect(rawIsentoPagamento(true)).toBe(true)
    expect(rawIsentoPagamento('true')).toBe(true)
    expect(rawIsentoPagamento('t')).toBe(true)
    expect(rawIsentoPagamento(1)).toBe(true)
    expect(rawIsentoPagamento('1')).toBe(true)
  })

  it('rejeita falsy / valores inesperados', () => {
    expect(rawIsentoPagamento(false)).toBe(false)
    expect(rawIsentoPagamento('false')).toBe(false)
    expect(rawIsentoPagamento('f')).toBe(false)
    expect(rawIsentoPagamento(0)).toBe(false)
    expect(rawIsentoPagamento(null)).toBe(false)
    expect(rawIsentoPagamento(undefined)).toBe(false)
    expect(rawIsentoPagamento('yes')).toBe(false)
  })
})

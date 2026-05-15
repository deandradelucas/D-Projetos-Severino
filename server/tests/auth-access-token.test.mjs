import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { signAccessToken, verifyAccessToken } from '../lib/auth-access-token.mjs'

describe('auth-access-token', () => {
  const prevNodeEnv = process.env.NODE_ENV
  const prevSecret = process.env.HORIZONTE_ACCESS_TOKEN_SECRET

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    process.env.HORIZONTE_ACCESS_TOKEN_SECRET = 'unit-test-hf-access-token-secret-key'
  })

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv
    if (prevSecret === undefined) delete process.env.HORIZONTE_ACCESS_TOKEN_SECRET
    else process.env.HORIZONTE_ACCESS_TOKEN_SECRET = prevSecret
  })

  it('assina e valida o sub (JWT HS256)', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const token = signAccessToken(id)
    const v = verifyAccessToken(token)
    expect(v?.sub).toBe(id)
  })

  it('rejeita token adulterado', () => {
    const token = signAccessToken('550e8400-e29b-41d4-a716-446655440000')
    const tampered = token.slice(0, -4) + 'xxxx'
    expect(verifyAccessToken(tampered)).toBeNull()
  })
})

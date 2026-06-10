import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import {
  setRefreshCookie,
  readRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} from '../lib/auth-cookie.mjs'

function buildApp() {
  const app = new Hono()
  app.post('/api/auth/set', (c) => {
    setRefreshCookie(c, 'tok-123')
    return c.json({ ok: true })
  })
  app.post('/api/auth/read', (c) => c.json({ token: readRefreshCookie(c) }))
  app.post('/api/auth/clear', (c) => {
    clearRefreshCookie(c)
    return c.json({ ok: true })
  })
  return app
}

const prevNodeEnv = process.env.NODE_ENV

describe('auth-cookie (refresh token HttpOnly — Story S1)', () => {
  beforeEach(() => { process.env.NODE_ENV = 'test' })
  afterEach(() => { process.env.NODE_ENV = prevNodeEnv })

  it('seta cookie HttpOnly, SameSite=Strict, Path=/api/auth e Max-Age do TTL', async () => {
    const app = buildApp()
    const res = await app.request('/api/auth/set', { method: 'POST' })
    const setCookie = res.headers.get('set-cookie') || ''
    expect(setCookie).toContain(`${REFRESH_COOKIE_NAME}=tok-123`)
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=Strict/i)
    expect(setCookie).toContain('Path=/api/auth')
    expect(setCookie).toMatch(/Max-Age=2592000/) // 30 dias default
    // fora de produção NÃO exige Secure (dev em http://localhost)
    expect(setCookie).not.toMatch(/;\s*Secure/i)
  })

  it('em produção o cookie é Secure', async () => {
    process.env.NODE_ENV = 'production'
    const app = buildApp()
    const res = await app.request('/api/auth/set', { method: 'POST' })
    expect(res.headers.get('set-cookie') || '').toMatch(/;\s*Secure/i)
  })

  it('lê o token do header Cookie do request', async () => {
    const app = buildApp()
    const res = await app.request('/api/auth/read', {
      method: 'POST',
      headers: { Cookie: `${REFRESH_COOKIE_NAME}=meu-token; outra=x` },
    })
    expect((await res.json()).token).toBe('meu-token')
  })

  it('retorna vazio sem cookie', async () => {
    const app = buildApp()
    const res = await app.request('/api/auth/read', { method: 'POST' })
    expect((await res.json()).token).toBe('')
  })

  it('clear expira o cookie no mesmo Path', async () => {
    const app = buildApp()
    const res = await app.request('/api/auth/clear', { method: 'POST' })
    const setCookie = res.headers.get('set-cookie') || ''
    expect(setCookie).toContain(`${REFRESH_COOKIE_NAME}=`)
    expect(setCookie).toContain('Path=/api/auth')
    expect(setCookie).toMatch(/Max-Age=0/)
  })
})

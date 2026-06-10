import { describe, it, expect } from 'vitest'
import { clientKeyFromHono } from '../lib/rate-limit.mjs'

function ctxWithHeaders(headers) {
  const map = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return { req: { header: (name) => map[String(name).toLowerCase()] } }
}

describe('clientKeyFromHono', () => {
  it('usa o último IP do X-Forwarded-For (o que o nosso proxy acrescenta)', () => {
    const c = ctxWithHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 200.10.20.30' })
    expect(clientKeyFromHono(c)).toBe('200.10.20.30')
  })

  it('não é enganado por XFF forjado pelo cliente (spoof vira prefixo, não o IP usado)', () => {
    // Cliente envia "x-forwarded-for: spoofed"; Traefik acrescenta o IP real no fim.
    const c = ctxWithHeaders({ 'x-forwarded-for': '6.6.6.6, 187.50.60.70' })
    expect(clientKeyFromHono(c)).toBe('187.50.60.70')
  })

  it('funciona com um único IP no XFF', () => {
    const c = ctxWithHeaders({ 'x-forwarded-for': '200.10.20.30' })
    expect(clientKeyFromHono(c)).toBe('200.10.20.30')
  })

  it('cai para x-real-ip e depois unknown sem XFF', () => {
    expect(clientKeyFromHono(ctxWithHeaders({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
    expect(clientKeyFromHono(ctxWithHeaders({}))).toBe('unknown')
  })
})

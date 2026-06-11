import { describe, it, expect, beforeEach } from 'vitest'
import { aiCacheKey, aiCacheGet, aiCacheSet, AI_CACHE_TTL, _resetMemCache } from '../lib/ai/ai-cache.mjs'

/* Sem REDIS_URL no ambiente de teste → exercita o fallback LRU em memória. */

describe('ai-cache (fallback in-memory)', () => {
  beforeEach(() => _resetMemCache())

  it('aiCacheKey é determinístico e namespaceado por kind', () => {
    const a = aiCacheKey('parse-tx', 'gastei 50 no mercado', '2026-06-10', 'u1')
    const b = aiCacheKey('parse-tx', 'gastei 50 no mercado', '2026-06-10', 'u1')
    expect(a).toBe(b)
    expect(a.startsWith('aic:parse-tx:')).toBe(true)
  })

  it('partes diferentes → chaves diferentes (data separa dias)', () => {
    const hoje = aiCacheKey('parse-tx', 'comprei pão ontem', '2026-06-10', 'u1')
    const ontem = aiCacheKey('parse-tx', 'comprei pão ontem', '2026-06-09', 'u1')
    expect(hoje).not.toBe(ontem)
  })

  it('usuários diferentes não compartilham cache de categoria', () => {
    const u1 = aiCacheKey('categoria', 'uber', 'DESPESA', 'cat-a,cat-b')
    const u2 = aiCacheKey('categoria', 'uber', 'DESPESA', 'cat-x,cat-y')
    expect(u1).not.toBe(u2)
  })

  it('round-trip: set guarda objeto, get desserializa', async () => {
    const key = aiCacheKey('parse-tx', 'almoço 30', '2026-06-10', 'u1')
    const value = { tipo: 'DESPESA', valor: 30, descricao: 'Almoço' }
    await aiCacheSet(key, value, AI_CACHE_TTL.parseTransacao)
    expect(await aiCacheGet(key)).toEqual(value)
  })

  it('miss retorna null', async () => {
    expect(await aiCacheGet(aiCacheKey('parse-tx', 'inexistente', 'x', 'y'))).toBeNull()
  })

  it('expira com TTL vencido', async () => {
    const key = aiCacheKey('lista', 'arroz', '2026-06-10', 'u1')
    await aiCacheSet(key, { itens: ['arroz'] }, -1) // expiresAt no passado → vencido
    expect(await aiCacheGet(key)).toBeNull()
  })

  it('valor não-serializável não derruba (não cacheia)', async () => {
    const key = aiCacheKey('parse-tx', 'circular', 'x', 'y')
    const circular = {}
    circular.self = circular
    await expect(aiCacheSet(key, circular, 60)).resolves.toBeUndefined()
    expect(await aiCacheGet(key)).toBeNull()
  })

  it('TTLs por tipo são sensatos (categoria > parse)', () => {
    expect(AI_CACHE_TTL.categoria).toBeGreaterThan(AI_CACHE_TTL.parseTransacao)
    expect(AI_CACHE_TTL.parseTransacao).toBe(24 * 60 * 60)
  })
})

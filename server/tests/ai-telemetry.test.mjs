import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordAiCall,
  recordCache,
  aiTelemetrySnapshot,
  _resetMemCounters,
} from '../lib/ai/ai-telemetry.mjs'
import { hojeYmdBrt } from '../lib/date-brt.mjs'

/* Sem REDIS_URL → contadores em memória. */

describe('ai-telemetry (fallback in-memory)', () => {
  beforeEach(() => _resetMemCounters())

  it('conta chamadas por provider:fluxo:resultado', async () => {
    recordAiCall('gemini', 'parse-tx', 'ok')
    recordAiCall('gemini', 'parse-tx', 'ok')
    recordAiCall('groq', 'parse-tx', 'fail')
    const snap = await aiTelemetrySnapshot()
    expect(snap['gemini:parse-tx:ok']).toBe(2)
    expect(snap['groq:parse-tx:fail']).toBe(1)
    expect(snap.dia).toBe(hojeYmdBrt())
  })

  it('conta cache hit/miss', async () => {
    recordCache(true)
    recordCache(true)
    recordCache(false)
    const snap = await aiTelemetrySnapshot()
    expect(snap['cache:hit']).toBe(2)
    expect(snap['cache:miss']).toBe(1)
  })

  it('snapshot vazio só traz o dia', async () => {
    const snap = await aiTelemetrySnapshot()
    expect(Object.keys(snap)).toEqual(['dia'])
  })

  it('nunca lança com argumentos estranhos', () => {
    expect(() => recordAiCall(undefined, null, '')).not.toThrow()
    expect(() => recordCache(undefined)).not.toThrow()
  })
})

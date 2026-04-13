import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureFutureMonthlyAnchor,
  normalizarProximaCobrancaMensal,
  shiftToFollowingCalendarMonth,
} from '../lib/pagamentos-mp.mjs'

describe('pagamentos-mp helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shifts to the same day next calendar month and clamps to last-day', () => {
    const original = new Date(Date.UTC(2024, 0, 31, 12, 30, 0))
    const next = shiftToFollowingCalendarMonth(original)
    expect(next.toISOString()).toBe(new Date(Date.UTC(2024, 1, 29, 12, 30, 0)).toISOString())
  })

  it('ensureFutureMonthlyAnchor advances until result is after now', () => {
    const now = new Date(Date.UTC(2025, 0, 15, 10, 0, 0))
    vi.setSystemTime(now)
    const anchor = new Date(Date.UTC(2024, 11, 10, 8, 0, 0))
    const future = ensureFutureMonthlyAnchor(anchor, now)
    expect(future.getTime()).toBeGreaterThan(now.getTime())
    expect(future.getUTCMonth()).toBe(1) // February
  })

  it('normalizarProximaCobrancaMensal moves to following month when charged zero in same month', () => {
    const systemTime = new Date(Date.UTC(2025, 0, 10, 9, 0, 0))
    vi.setSystemTime(systemTime)
    const pre = { summarized: { charged_quantity: 0 } }
    const next = new Date(Date.UTC(2025, 0, 20, 9, 0, 0)).toISOString()
    const normalized = normalizarProximaCobrancaMensal(pre, next)
    expect(normalized).toBe(new Date(Date.UTC(2025, 1, 20, 9, 0, 0)).toISOString())
  })

  it('normalizarProximaCobrancaMensal rolls forward when charged quantity is positive but next is past', () => {
    const systemTime = new Date(Date.UTC(2025, 0, 20, 9, 0, 0))
    vi.setSystemTime(systemTime)
    const pre = { summarized: { charged_quantity: 5 } }
    const next = new Date(Date.UTC(2025, 0, 10, 9, 0, 0)).toISOString()
    const normalized = normalizarProximaCobrancaMensal(pre, next)
    expect(new Date(normalized).getUTCMonth()).toBe(1)
    expect(new Date(normalized).getTime()).toBeGreaterThan(systemTime.getTime())
  })
})

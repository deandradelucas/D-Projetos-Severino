import { describe, expect, it } from 'vitest'
import { hojeYmdBrt, partesBrt, fimDoDiaBrtIso } from '../lib/date-brt.mjs'

describe('date-brt', () => {
  // 01:30 UTC de 02/jun = 22:30 BRT de 01/jun → o dia BRT ainda é 01.
  const lateNightUtc = new Date('2026-06-02T01:30:00Z')
  // 15:00 UTC de 02/jun = 12:00 BRT de 02/jun.
  const noonBrt = new Date('2026-06-02T15:00:00Z')

  it('hojeYmdBrt usa o dia BRT, não UTC (22h30 BRT continua no dia anterior ao UTC)', () => {
    expect(hojeYmdBrt(lateNightUtc)).toBe('2026-06-01')
    expect(hojeYmdBrt(noonBrt)).toBe('2026-06-02')
  })

  it('partesBrt devolve ano/mes/dia em BRT', () => {
    expect(partesBrt(lateNightUtc)).toEqual({ ano: 2026, mes: 6, dia: 1 })
  })

  it('fimDoDiaBrtIso fecha o dia BRT com offset -03:00', () => {
    expect(fimDoDiaBrtIso(lateNightUtc)).toBe('2026-06-01T23:59:59.999-03:00')
  })
})

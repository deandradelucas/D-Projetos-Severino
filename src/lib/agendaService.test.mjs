import { describe, expect, it } from 'vitest'
import { getAgendaSummary } from './agendaService.js'

describe('getAgendaSummary', () => {
  it('conta totais financeiros só para pendentes relevantes', () => {
    const events = [
      {
        id: '1',
        type: 'conta-pagar',
        amount: 100,
        status: 'pendente',
        startAt: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'conta-pagar',
        amount: 50,
        status: 'pago',
        startAt: new Date().toISOString(),
      },
      {
        id: '3',
        type: 'conta-receber',
        amount: 200,
        status: 'pendente',
        startAt: new Date().toISOString(),
      },
    ]
    const s = getAgendaSummary(events)
    expect(s.payableTotal).toBe(100)
    expect(s.receivableTotal).toBe(200)
  })
})

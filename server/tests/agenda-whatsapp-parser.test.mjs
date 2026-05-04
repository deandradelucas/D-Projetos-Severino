import { describe, expect, it } from 'vitest'
import {
  draftAgendaFromTextHeuristic,
  isAgendaMessage,
  parseAgendaDateTime,
} from '../lib/domain/agenda-whatsapp.mjs'

describe('agenda WhatsApp parser', () => {
  it('reconhece compromissos em linguagem natural', () => {
    expect(isAgendaMessage('tenho dentista sexta às 14h')).toBe(true)
    expect(isAgendaMessage('me lembra de pagar a luz amanhã 9h')).toBe(true)
    expect(isAgendaMessage('me lembre quando for 22:00')).toBe(true)
    expect(isAgendaMessage('me avise de ligar para o contador amanhã às 8h')).toBe(true)
    expect(isAgendaMessage('me alerte de tomar remédio em 30 minutos')).toBe(true)
    expect(isAgendaMessage('anota reunião com João dia 10/05 às 16h30')).toBe(true)
  })

  it('interpreta data explícita e horário standalone no fuso de São Paulo', () => {
    const data = parseAgendaDateTime('consulta médica dia 10/05/2026 16:30')

    expect(data?.toISOString()).toBe('2026-05-10T19:30:00.000Z')
  })

  it('interpreta lembretes relativos', () => {
    const base = new Date('2026-05-03T06:30:00.000Z')
    const data = parseAgendaDateTime('me lembra em 30 minutos de tomar remédio', base)

    expect(data?.toISOString()).toBe('2026-05-03T07:00:00.000Z')
  })

  it('interpreta pedido de notificação sem título explícito', () => {
    const base = new Date('2026-05-03T06:30:00.000Z')
    const data = parseAgendaDateTime('me lembre quando for 22:00', base)

    expect(data?.toISOString()).toBe('2026-05-04T01:00:00.000Z')
  })

  it('draft heurístico para o app web devolve título e ISO de início', () => {
    const base = new Date('2026-05-04T12:00:00.000Z')
    const d = draftAgendaFromTextHeuristic('marcar reunião amanhã às 15h', base)
    expect(d).toBeTruthy()
    expect(d.origem).toBe('heuristica')
    expect(d.titulo.length).toBeGreaterThan(1)
    expect(d.inicio).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect([0, 5, 10, 15, 30, 60]).toContain(d.lembrar_minutos_antes)
  })
})

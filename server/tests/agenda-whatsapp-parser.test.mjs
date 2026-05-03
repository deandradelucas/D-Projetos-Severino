import { describe, expect, it } from 'vitest'
import { isAgendaMessage, parseAgendaDateTime } from '../lib/domain/agenda-whatsapp.mjs'

describe('agenda WhatsApp parser', () => {
  it('reconhece compromissos em linguagem natural', () => {
    expect(isAgendaMessage('tenho dentista sexta às 14h')).toBe(true)
    expect(isAgendaMessage('me lembra de pagar a luz amanhã 9h')).toBe(true)
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
})

import { describe, expect, it } from 'vitest'
import {
  draftAgendaFromTextHeuristic,
  isAgendaMessage,
  parseAgendaDateTime,
  parseReminderMinutes,
} from '../lib/domain/agenda-whatsapp.mjs'

describe('agenda WhatsApp parser', () => {
  it('reconhece menu numérico 1–5 (e alias aviso1–aviso5)', () => {
    expect(isAgendaMessage('3')).toBe(true)
    expect(isAgendaMessage('aviso2')).toBe(true)
    expect(isAgendaMessage('AVISO5')).toBe(true)
    expect(isAgendaMessage('6')).toBe(false)
    expect(isAgendaMessage('12')).toBe(false)
  })

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

  it('sem data no texto: horário que já passou hoje em SP vai para o dia seguinte', () => {
    const base = new Date('2026-05-04T20:15:00.000Z')
    const data = parseAgendaDateTime('reunião 15:30', base)

    expect(data?.toISOString()).toBe('2026-05-05T18:30:00.000Z')
  })

  it('sem data no texto: horário ainda futuro hoje em SP mantém o mesmo dia', () => {
    const base = new Date('2026-05-04T20:15:00.000Z')
    const data = parseAgendaDateTime('reunião 18:30', base)

    expect(data?.toISOString()).toBe('2026-05-04T21:30:00.000Z')
  })

  it('não confunde horário "para/as … HH horas" com antecedência "HH horas antes"', () => {
    expect(parseReminderMinutes('reunião para as 17 horas')).toBe(null)
    expect(parseReminderMinutes('reunião para as 17 horas antes do almoço')).toBe(null)
    expect(parseReminderMinutes('marcar reuniao as 17 horas antes da daily')).toBe(null)
  })

  it('mantém antecedência explícita em horas quando não é padrão de horário', () => {
    expect(parseReminderMinutes('me avise 17 horas antes da viagem')).toBe(1020)
    expect(parseReminderMinutes('avisar 5 horas antes')).toBe(300)
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

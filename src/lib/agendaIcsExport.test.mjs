import { describe, expect, it } from 'vitest'
import { icsEscapeText, buildAgendaIcs } from './agendaIcsExport.js'

describe('icsEscapeText', () => {
  it('escapa caracteres especiais do iCalendar', () => {
    expect(icsEscapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
  })
})

describe('buildAgendaIcs', () => {
  it('gera VEVENT com VALARM para evento futuro', () => {
    const now = new Date('2026-04-01T12:00:00Z').getTime()
    const start = new Date('2026-04-15T14:00:00Z').toISOString()
    const ics = buildAgendaIcs(
      [
        {
          id: 'test-uuid',
          title: 'Reunião X',
          description: 'Detalhe',
          type: 'compromisso',
          startAt: start,
          endAt: new Date('2026-04-15T15:00:00Z').toISOString(),
          allDay: false,
          status: 'pendente',
          reminder: '30-min',
        },
      ],
      { nowMs: now }
    )
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER;RELATED=START:-PT30M')
    expect(ics).toContain('SUMMARY:Reunião X')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('omite eventos concluídos', () => {
    const now = Date.now()
    const ics = buildAgendaIcs(
      [
        {
          id: '1',
          title: 'Feito',
          startAt: new Date(now + 86400000).toISOString(),
          endAt: new Date(now + 90000000).toISOString(),
          status: 'concluido',
        },
      ],
      { nowMs: now }
    )
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})

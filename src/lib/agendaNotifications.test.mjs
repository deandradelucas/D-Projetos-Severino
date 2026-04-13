import { describe, expect, it } from 'vitest'
import { reminderMinutesBefore, scanAgendaEventsForNotifications } from './agendaNotifications.js'

describe('reminderMinutesBefore', () => {
  it('mapeia lembretes conhecidos', () => {
    expect(reminderMinutesBefore('agora')).toBe(0)
    expect(reminderMinutesBefore('15-min')).toBe(15)
    expect(reminderMinutesBefore('30-min')).toBe(30)
    expect(reminderMinutesBefore('1-hora')).toBe(60)
    expect(reminderMinutesBefore('1-dia')).toBe(24 * 60)
    expect(reminderMinutesBefore(undefined)).toBe(30)
  })
})

describe('scanAgendaEventsForNotifications', () => {
  it('não dispara sem permissão granted', () => {
    const original = globalThis.Notification
    globalThis.Notification = { permission: 'denied' }
    try {
      const fired = new Set()
      scanAgendaEventsForNotifications(
        [
          {
            id: '1',
            title: 'X',
            startAt: new Date(Date.now() + 60_000).toISOString(),
            reminder: 'agora',
            status: 'pendente',
          },
        ],
        fired
      )
      expect(fired.size).toBe(0)
    } finally {
      globalThis.Notification = original
    }
  })
})

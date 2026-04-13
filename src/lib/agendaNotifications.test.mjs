import { describe, expect, it } from 'vitest'
import {
  isReminderNotifyWindow,
  reminderMinutesBefore,
  scanAgendaEventsForNotifications,
} from './agendaNotifications.js'

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

describe('isReminderNotifyWindow', () => {
  it('30 min antes: válido desde o instante do lembrete até ao início do evento', () => {
    const startMs = 1_700_000_000_000
    const notifyAtMs = startMs - 30 * 60_000
    expect(isReminderNotifyWindow(notifyAtMs - 1000, startMs, notifyAtMs, 30)).toBe(false)
    expect(isReminderNotifyWindow(notifyAtMs, startMs, notifyAtMs, 30)).toBe(true)
    expect(isReminderNotifyWindow(startMs - 60_000, startMs, notifyAtMs, 30)).toBe(true)
    expect(isReminderNotifyWindow(startMs, startMs, notifyAtMs, 30)).toBe(false)
  })

  it('agora: válido no início e até 30 min depois', () => {
    const startMs = 1_700_000_000_000
    const notifyAtMs = startMs
    expect(isReminderNotifyWindow(startMs - 1, startMs, notifyAtMs, 0)).toBe(false)
    expect(isReminderNotifyWindow(startMs, startMs, notifyAtMs, 0)).toBe(true)
    expect(isReminderNotifyWindow(startMs + 29 * 60_000, startMs, notifyAtMs, 0)).toBe(true)
    expect(isReminderNotifyWindow(startMs + 31 * 60_000, startMs, notifyAtMs, 0)).toBe(false)
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

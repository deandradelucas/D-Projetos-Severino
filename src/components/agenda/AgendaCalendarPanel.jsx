import React from 'react'
import { saoPauloDateKey, formatMonthTitle, plural } from '../../lib/agendaDateUtils'

/**
 * Grid do calendário mensal da Agenda.
 *
 * Props:
 *   calendarDays      — array de { key, day, isCurrentMonth }
 *   selectedDateKey   — string 'YYYY-MM-DD'
 *   eventDateKeys     — Set<string>
 *   eventDateKinds    — Map<string, string>
 *   calendarMonthKey  — string 'YYYY-MM'
 *   statsToday        — number
 *   statsReminders    — number
 *   onSelectDay       — fn(dateKey: string)
 *   onNavigateMonth   — fn(amount: number)
 */
export function AgendaCalendarPanel({
  calendarDays,
  selectedDateKey,
  eventDateKeys,
  eventDateKinds,
  calendarMonthKey,
  statsToday,
  statsReminders,
  onSelectDay,
  onNavigateMonth,
}) {
  return (
    <section className="agenda-calendar-panel" aria-label="Calendário da agenda">
      <div className="agenda-calendar-head">
        <div>
          <strong>{formatMonthTitle(calendarMonthKey)}</strong>
          <span>
            {plural(statsToday, 'item hoje', 'itens hoje')} · {plural(statsReminders, 'notificação', 'notificações')} no dia
          </span>
        </div>
        <div className="agenda-calendar-nav" aria-label="Navegar meses">
          <button type="button" onClick={() => onNavigateMonth(-1)} aria-label="Mês anterior">
            ‹
          </button>
          <button type="button" onClick={() => onNavigateMonth(1)} aria-label="Próximo mês">
            ›
          </button>
        </div>
      </div>

      <div className="agenda-calendar-weekdays" aria-hidden="true">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="agenda-calendar-grid">
        {calendarDays.map((day) => {
          const isSelected = day.key === selectedDateKey
          const hasEvent = eventDateKeys.has(day.key)
          const dayKind = eventDateKinds.get(day.key)
          const isCurrentDay = day.key === saoPauloDateKey(new Date())
          return (
            <button
              type="button"
              key={day.key}
              className={[
                'agenda-calendar-day',
                day.isCurrentMonth ? '' : 'agenda-calendar-day--muted',
                isCurrentDay ? 'agenda-calendar-day--today' : '',
                isSelected ? 'agenda-calendar-day--selected' : '',
                hasEvent ? 'agenda-calendar-day--has-event' : '',
                dayKind ? `agenda-calendar-day--kind-${dayKind}` : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                onSelectDay(day.key)
              }}
              aria-pressed={isSelected}
              aria-label={`${day.day} ${hasEvent ? 'com itens' : 'sem itens'}`}
            >
              <span>{day.day}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

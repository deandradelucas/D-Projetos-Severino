import React, { useState } from 'react'
import { saoPauloDateKey, formatMonthTitle, plural, formatTime, agendaItemKind, AGENDA_KIND_META } from '../../lib/agendaDateUtils'

/**
 * Grid do calendário mensal/semanal da Agenda.
 *
 * Props:
 *   calendarDays      — array de { key, day, isCurrentMonth }
 *   weekDays          — array de { key, day, weekday, isToday } (visão semanal)
 *   view              — 'month' | 'week'
 *   onChangeView      — fn('month' | 'week')
 *   selectedDateKey   — string 'YYYY-MM-DD'
 *   eventsByDate      — Map<string, evento[]> (para hover preview)
 *   eventDateKeys     — Set<string>
 *   eventDateKinds    — Map<string, string>
 *   calendarMonthKey  — string 'YYYY-MM'
 *   statsToday        — number
 *   statsReminders    — number
 *   onSelectDay       — fn(dateKey)
 *   onNavigateMonth   — fn(amount)
 *   draggingEvent     — evento|null (drag-to-reschedule)
 *   onDropDay         — fn(dateKey)
 */
export function AgendaCalendarPanel({
  calendarDays,
  weekDays,
  view = 'month',
  onChangeView,
  selectedDateKey,
  eventsByDate,
  eventDateKeys,
  eventDateKinds,
  calendarMonthKey,
  statsToday,
  statsReminders,
  onSelectDay,
  onNavigateMonth,
  draggingEvent,
  onDropDay,
}) {
  const [hoverKey, setHoverKey] = useState(null)
  const [dragOverKey, setDragOverKey] = useState(null)

  const renderDay = (day, opts = {}) => {
    const isSelected = day.key === selectedDateKey
    const hasEvent = eventDateKeys.has(day.key)
    const dayKind = eventDateKinds.get(day.key)
    const isCurrentDay = day.key === saoPauloDateKey(new Date())
    const dayEvents = eventsByDate?.get(day.key) || []
    const isDropTarget = draggingEvent && dragOverKey === day.key
    return (
      <button
        type="button"
        key={day.key}
        className={[
          'agenda-calendar-day',
          opts.week ? 'agenda-calendar-day--week' : '',
          day.isCurrentMonth === false ? 'agenda-calendar-day--muted' : '',
          isCurrentDay ? 'agenda-calendar-day--today' : '',
          isSelected ? 'agenda-calendar-day--selected' : '',
          hasEvent ? 'agenda-calendar-day--has-event' : '',
          dayKind ? `agenda-calendar-day--kind-${dayKind}` : '',
          isDropTarget ? 'agenda-calendar-day--drop-target' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => onSelectDay(day.key)}
        onMouseEnter={() => setHoverKey(day.key)}
        onMouseLeave={() => setHoverKey((k) => (k === day.key ? null : k))}
        onDragOver={(e) => {
          if (!draggingEvent) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOverKey(day.key)
        }}
        onDragLeave={() => setDragOverKey((k) => (k === day.key ? null : k))}
        onDrop={(e) => {
          if (!draggingEvent) return
          e.preventDefault()
          setDragOverKey(null)
          onDropDay?.(day.key)
        }}
        aria-pressed={isSelected}
        aria-label={`${day.day} ${hasEvent ? 'com itens' : 'sem itens'}`}
      >
        {opts.week ? <span className="agenda-calendar-day__weekday">{day.weekday}</span> : null}
        <span className="agenda-calendar-day__num">{day.day}</span>
        {opts.week && hasEvent ? (
          <span className="agenda-calendar-day__count">{dayEvents.length}</span>
        ) : null}

        {/* Hover preview (feature 5) — só na visão mensal.
            Na primeira linha do grid o preview vai PARA BAIXO da célula
            (--below) para não cobrir o cabeçalho do calendário. */}
        {!opts.week && hoverKey === day.key && dayEvents.length > 0 ? (
          <span className={`agenda-day-preview${opts.firstRow ? ' agenda-day-preview--below' : ''}`} role="tooltip">
            {dayEvents.slice(0, 4).map((ev) => {
              const meta = AGENDA_KIND_META[agendaItemKind(ev)]
              return (
                <span className="agenda-day-preview__row" key={ev.id}>
                  <span className={`agenda-day-preview__dot agenda-day-preview__dot--${meta.tone}`} />
                  <span className="agenda-day-preview__time">{formatTime(ev.inicio)}</span>
                  <span className="agenda-day-preview__title">{ev.titulo}</span>
                </span>
              )
            })}
            {dayEvents.length > 4 ? (
              <span className="agenda-day-preview__more">+{dayEvents.length - 4} mais</span>
            ) : null}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <section className="agenda-calendar-panel" aria-label="Calendário da agenda">
      <div className="agenda-calendar-head">
        <div className="agenda-calendar-title">
          <strong>{formatMonthTitle(calendarMonthKey)}</strong>
          <span>
            {plural(statsToday, 'item hoje', 'itens hoje')} · {plural(statsReminders, 'notificação', 'notificações')} no dia
          </span>
        </div>
        <div className="agenda-calendar-controls">
          {/* Toggle visão (feature 10) */}
          <div className="agenda-view-toggle" role="group" aria-label="Alternar visão">
            <button
              type="button"
              className={`agenda-view-toggle__btn${view === 'month' ? ' agenda-view-toggle__btn--active' : ''}`}
              onClick={() => onChangeView?.('month')}
              aria-pressed={view === 'month'}
            >
              Mês
            </button>
            <button
              type="button"
              className={`agenda-view-toggle__btn${view === 'week' ? ' agenda-view-toggle__btn--active' : ''}`}
              onClick={() => onChangeView?.('week')}
              aria-pressed={view === 'week'}
            >
              Semana
            </button>
          </div>
          <div className="agenda-calendar-nav" aria-label="Navegar meses">
            <button type="button" onClick={() => onNavigateMonth(-1)} aria-label="Mês anterior">‹</button>
            <button type="button" onClick={() => onNavigateMonth(1)} aria-label="Próximo mês">›</button>
          </div>
        </div>
      </div>

      {view === 'week' ? (
        <div className="agenda-week-grid">
          {(weekDays || []).map((day) => renderDay(day, { week: true }))}
        </div>
      ) : (
        <>
          <div className="agenda-calendar-weekdays" aria-hidden="true">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="agenda-calendar-grid">
            {calendarDays.map((day, i) => renderDay(day, { firstRow: i < 7 }))}
          </div>
        </>
      )}

      {draggingEvent ? (
        <p className="agenda-calendar-drag-hint" role="status">
          Solte num dia para reagendar &quot;{draggingEvent.titulo}&quot;
        </p>
      ) : null}
    </section>
  )
}

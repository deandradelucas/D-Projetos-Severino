import React, { useMemo, useState } from 'react'
import { AgendaKindIcon } from './AgendaKindIcon'
import {
  formatSelectedDayTitle,
  formatAgendaListReminderMeta,
  formatTime,
  eventTone,
  agendaItemKind,
  agendaPeriodoDoDia,
  AGENDA_KIND_META,
  AGENDA_STATUS_BADGE,
} from '../../lib/agendaDateUtils'

const FILTROS = [
  { key: 'todos', label: 'Tudo' },
  { key: 'event', label: 'Compromissos' },
  { key: 'reminder', label: 'Notificações' },
  { key: 'milestone', label: 'Marcos' },
]

const PERIODOS = ['manha', 'tarde', 'noite', 'dia']
const PERIODO_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', dia: 'Dia' }
const PERIODO_ICON = {
  manha: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  tarde: <><circle cx="12" cy="12" r="4"/><path d="M12 4v1M12 19v1M5 12H4M20 12h-1M6.3 6.3l.7.7M17 17l.7.7"/></>,
  noite: <path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9z"/>,
  dia: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></>,
}

/**
 * Lista de eventos do dia selecionado na Agenda.
 * Timeline por horário, agrupada por período, com filtro de tipo,
 * badges de status e drag-to-reschedule.
 */
export function AgendaDayList({
  selectedEvents,
  loading,
  error,
  selectedDateKey,
  onOpenNew,
  onEdit,
  onSetStatus,
  onDelete,
  onDragStartEvent,
  onDragEndEvent,
}) {
  const [filtro, setFiltro] = useState('todos')

  // Contagem por tipo (para badges nos pills de filtro)
  const counts = useMemo(() => {
    const c = { todos: selectedEvents.length, event: 0, reminder: 0, milestone: 0 }
    for (const ev of selectedEvents) {
      const k = agendaItemKind(ev)
      if (k === 'event') c.event++
      else if (k === 'reminder') c.reminder++
      else if (k === 'milestone') c.milestone++
      else if (k === 'done') c.event++ // concluídos contam como compromissos para o filtro
    }
    return c
  }, [selectedEvents])

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return selectedEvents
    return selectedEvents.filter((ev) => {
      const k = agendaItemKind(ev)
      if (filtro === 'event') return k === 'event' || k === 'done'
      return k === filtro
    })
  }, [selectedEvents, filtro])

  // Agrupa por período do dia (Manhã/Tarde/Noite), ordenado por horário
  const grupos = useMemo(() => {
    const map = new Map()
    for (const ev of filtrados) {
      const p = agendaPeriodoDoDia(ev.inicio)
      if (!map.has(p.key)) map.set(p.key, [])
      map.get(p.key).push(ev)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
    }
    return PERIODOS.filter((k) => map.has(k)).map((k) => ({ key: k, label: PERIODO_LABEL[k], itens: map.get(k) }))
  }, [filtrados])

  return (
    <section className="agenda-list-panel agenda-list-panel--daily" aria-label="Lista do dia selecionado">
      <div className="agenda-list-panel__header">
        <div>
          <span className="agenda-section-eyebrow">Agenda do dia</span>
          <h2>{formatSelectedDayTitle(selectedDateKey)}</h2>
        </div>
        <button
          type="button"
          className="agenda-floating-add"
          onClick={onOpenNew}
          aria-label="Adicionar compromisso ou notificação"
        >
          +
        </button>
      </div>

      {/* Filtro por tipo (feature 2) */}
      {!loading && !error && selectedEvents.length > 0 && (
        <div className="agenda-filter-pills" role="group" aria-label="Filtrar por tipo">
          {FILTROS.map((f) => {
            const n = counts[f.key] ?? 0
            if (f.key !== 'todos' && n === 0) return null
            return (
              <button
                key={f.key}
                type="button"
                className={`agenda-filter-pill${filtro === f.key ? ' agenda-filter-pill--active' : ''}${f.key !== 'todos' ? ` agenda-filter-pill--${f.key}` : ''}`}
                onClick={() => setFiltro(f.key)}
                aria-pressed={filtro === f.key}
              >
                {f.label}
                <span className="agenda-filter-pill__count">{n}</span>
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="agenda-empty">Carregando agenda...</div>
      ) : error ? (
        <div className="agenda-empty agenda-empty--error">{error}</div>
      ) : selectedEvents.length === 0 ? (
        /* Empty ilustrado com CTA duplo (feature 6) */
        <div className="agenda-empty agenda-empty--illustrated">
          <div className="agenda-empty__art" aria-hidden="true">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="3" />
              <path d="M3 10h18M8 2v4M16 2v4" />
              <path d="M12 14v3M10.5 15.5h3" />
            </svg>
          </div>
          <strong>Nenhum item neste dia</strong>
          <span>Crie um compromisso ou notificação — ou peça pelo WhatsApp: &quot;me avise de pagar a luz amanhã às 9h&quot;.</span>
          <div className="agenda-empty__ctas">
            <button type="button" className="agenda-empty__cta agenda-empty__cta--primary" onClick={onOpenNew}>
              + Compromisso
            </button>
            <button type="button" className="agenda-empty__cta" onClick={onOpenNew}>
              + Notificação
            </button>
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="agenda-empty">
          <span>Nenhum item desse tipo neste dia.</span>
        </div>
      ) : (
        <div className="agenda-groups">
          {grupos.map((grupo) => (
            <div className="agenda-period-group" key={grupo.key}>
              <div className="agenda-period-group__head">
                <span className="agenda-period-group__icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {PERIODO_ICON[grupo.key]}
                  </svg>
                </span>
                <span className="agenda-period-group__label">{grupo.label}</span>
                <span className="agenda-period-group__count">{grupo.itens.length}</span>
              </div>

              <div className="agenda-timeline">
                {grupo.itens.map((evento) => {
                  const kind = agendaItemKind(evento)
                  const meta = AGENDA_KIND_META[kind]
                  const reminderMeta = formatAgendaListReminderMeta(evento, kind)
                  const statusBadge = AGENDA_STATUS_BADGE[evento.status] || AGENDA_STATUS_BADGE.AGENDADO
                  return (
                    <div
                      className="agenda-timeline-item"
                      key={evento.id}
                      draggable={evento.status !== 'CONCLUIDO' && evento.status !== 'CANCELADO'}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', String(evento.id))
                        onDragStartEvent?.(evento)
                      }}
                      onDragEnd={() => onDragEndEvent?.()}
                    >
                      <time className="agenda-timeline-item__time" dateTime={evento.inicio}>
                        {formatTime(evento.inicio)}
                      </time>
                      <div className={`agenda-timeline-item__track agenda-timeline-item__track--${meta.tone}`} aria-hidden="true">
                        <span className="agenda-timeline-item__dot" />
                        <span className="agenda-timeline-item__line" />
                      </div>
                      <article
                        className={`agenda-day-item agenda-day-item--${meta.tone} agenda-event--${eventTone(evento.status)}`}
                      >
                        <div className="agenda-day-item__icon" aria-hidden="true">
                          <AgendaKindIcon type={meta.icon} />
                        </div>
                        <div className="agenda-day-item__main">
                          <div className="agenda-day-item__top">
                            <span className="agenda-day-item__time">{formatTime(evento.inicio)}</span>
                            <span className="agenda-day-item__type">{meta.label}</span>
                            <span className={`agenda-status-badge agenda-status-badge--${statusBadge.tone}`}>
                              {statusBadge.label}
                            </span>
                          </div>
                          <h3>{evento.titulo}</h3>
                          {reminderMeta ? <p className="agenda-day-item__reminder">{reminderMeta}</p> : null}
                          {evento.local ? <p className="agenda-event__local">{evento.local}</p> : null}
                        </div>
                        <div className="agenda-day-item__actions">
                          <button type="button" onClick={() => onEdit(evento)} aria-label={`Editar ${evento.titulo}`}>
                            Editar
                          </button>
                          {evento.status !== 'CONCLUIDO' && (
                            <button
                              type="button"
                              onClick={() => onSetStatus(evento, 'CONCLUIDO')}
                              aria-label={`Concluir ${evento.titulo}`}
                            >
                              Concluir
                            </button>
                          )}
                          <button
                            type="button"
                            className="agenda-day-item__btn agenda-day-item__btn--danger agenda-day-item__btn--delete"
                            onClick={() => onDelete(evento)}
                            aria-label={`Excluir ${evento.titulo}`}
                          >
                            <svg
                              className="agenda-day-item__delete-icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                            <span className="agenda-day-item__btn-label">Excluir</span>
                          </button>
                        </div>
                      </article>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

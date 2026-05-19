import React from 'react'
import { AgendaKindIcon } from './AgendaKindIcon'

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="agenda-day-item__delete-icon" aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}
import {
  formatSelectedDayTitle,
  formatAgendaListReminderMeta,
  formatEventDatetime,
  eventTone,
  agendaItemKind,
  AGENDA_KIND_META,
} from '../../lib/agendaDateUtils'

/**
 * Lista de eventos do dia selecionado na Agenda.
 *
 * Props:
 *   selectedEvents  — array de eventos do dia
 *   loading         — boolean
 *   error           — string
 *   selectedDateKey — string 'YYYY-MM-DD'
 *   onOpenNew       — fn()
 *   onEdit          — fn(evento)
 *   onSetStatus     — fn(evento, status)
 *   onDelete        — fn(evento)
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
}) {
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

      {loading ? (
        <div className="agenda-empty">Carregando agenda...</div>
      ) : error ? (
        <div className="agenda-empty agenda-empty--error">{error}</div>
      ) : selectedEvents.length === 0 ? (
        <div className="agenda-empty">
          <strong>Nenhum item neste dia.</strong>
          <span>
            Toque no + para criar um item ou envie pelo WhatsApp:
            &quot;me avise de pagar a luz amanhã às 9h&quot;.
          </span>
        </div>
      ) : (
        <div className="agenda-daily-list">
          {selectedEvents.map((evento) => {
            const kind = agendaItemKind(evento)
            const meta = AGENDA_KIND_META[kind]
            const reminderMeta = formatAgendaListReminderMeta(evento, kind)
            const datetime = formatEventDatetime(evento)
            return (
              <article
                className={`agenda-day-item agenda-day-item--${meta.tone} agenda-event--${eventTone(evento.status)}`}
                key={evento.id}
              >
                <div className="agenda-day-item__icon" aria-hidden="true">
                  <AgendaKindIcon type={meta.icon} />
                </div>
                <div className="agenda-day-item__main">
                  <span className="agenda-day-item__type">{meta.label}</span>
                  <h3>{evento.titulo}</h3>
                  {datetime ? <p className="agenda-day-item__datetime">{datetime}</p> : null}
                  {reminderMeta ? <p className="agenda-day-item__reminder">{reminderMeta}</p> : null}
                  {evento.local ? <p className="agenda-event__local">{evento.local}</p> : null}
                </div>
                <div className="agenda-day-item__actions">
                  <button type="button" onClick={() => onEdit(evento)} aria-label={`Editar ${evento.titulo}`}>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetStatus(evento, 'CONCLUIDO')}
                    aria-label={`Concluir ${evento.titulo}`}
                  >
                    Concluir
                  </button>
                  <button
                    type="button"
                    className="agenda-day-item__btn agenda-day-item__btn--danger agenda-day-item__btn--delete"
                    onClick={() => onDelete(evento)}
                    aria-label={`Excluir ${evento.titulo}`}
                  >
                    <TrashIcon />
                    <span className="agenda-day-item__btn-label">Excluir</span>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

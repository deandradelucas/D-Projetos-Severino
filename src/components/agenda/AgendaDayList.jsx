import React from 'react'
import { AgendaKindIcon } from './AgendaKindIcon'
import {
  formatSelectedDayTitle,
  formatAgendaListReminderMeta,
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
            Toque no + para criar um item. No modal, use "Interpretar com IA" ou envie pelo WhatsApp:
            "me avise de pagar a luz amanhã às 9h".
          </span>
        </div>
      ) : (
        <div className="agenda-daily-list">
          {selectedEvents.map((evento) => {
            const kind = agendaItemKind(evento)
            const meta = AGENDA_KIND_META[kind]
            const reminderMeta = formatAgendaListReminderMeta(evento, kind)
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
                    className="agenda-day-item__btn agenda-day-item__btn--danger"
                    onClick={() => onDelete(evento)}
                    aria-label={`Excluir ${evento.titulo}`}
                  >
                    Excluir
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

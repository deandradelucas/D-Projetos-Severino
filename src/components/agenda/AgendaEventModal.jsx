import { useEffect, useMemo, useState } from 'react'
import {
  AGENDA_EVENT_TYPES,
  AGENDA_TYPE_LABELS,
  AGENDA_STATUS_LABELS,
  AGENDA_PRIORITY_LABELS,
  AGENDA_RECURRENCE_LABELS,
  AGENDA_REMINDER_LABELS,
  STATUS_OPTIONS_BY_TYPE,
} from '../../lib/agendaConstants'

function toDatetimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60000)
  return local.toISOString().slice(0, 16)
}

function fromDatetimeLocalValue(s) {
  if (!s) return new Date().toISOString()
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

const EMPTY_FORM = () => ({
  title: '',
  description: '',
  type: AGENDA_EVENT_TYPES.COMPROMISSO,
  category: '',
  subcategory: '',
  startLocal: toDatetimeLocalValue(new Date().toISOString()),
  endLocal: '',
  allDay: false,
  location: '',
  notes: '',
  amount: '',
  status: 'pendente',
  priority: 'media',
  recurrence: 'nao-recorrente',
  reminder: '30-min',
  color: '#64748b',
  linkedTransactionId: '',
})

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object | null} props.event — evento existente (com id), rascunho (sem id) ou null
 * @param {(payload: object) => Promise<void>} props.onSubmit
 * @param {(id: string) => Promise<void>} [props.onDelete]
 * @param {(ev: object) => Promise<void>} [props.onDuplicate]
 */
export default function AgendaEventModal({ open, onClose, event, onSubmit, onDelete, onDuplicate }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = Boolean(event?.id)

  useEffect(() => {
    if (!open) return
    setError('')
    if (event && event.id) {
      setForm({
        title: event.title || '',
        description: event.description || '',
        type: event.type || AGENDA_EVENT_TYPES.COMPROMISSO,
        category: event.category || '',
        subcategory: event.subcategory || '',
        startLocal: toDatetimeLocalValue(event.startAt),
        endLocal: event.endAt ? toDatetimeLocalValue(event.endAt) : '',
        allDay: Boolean(event.allDay),
        location: event.location || '',
        notes: event.notes || '',
        amount: event.amount != null && event.amount !== '' ? String(event.amount) : '',
        status: event.status || 'pendente',
        priority: event.priority || 'media',
        recurrence: event.recurrence || 'nao-recorrente',
        reminder: event.reminder || '30-min',
        color: event.color || '#64748b',
        linkedTransactionId: event.linkedTransactionId || '',
      })
    } else if (event && !event.id && event.startAt) {
      const base = EMPTY_FORM()
      setForm({
        ...base,
        startLocal: toDatetimeLocalValue(event.startAt),
        endLocal: event.endAt ? toDatetimeLocalValue(event.endAt) : '',
        type: event.type || base.type,
        allDay: Boolean(event.allDay),
      })
    } else {
      setForm(EMPTY_FORM())
    }
  }, [open, event])

  const statusOptions = useMemo(() => {
    return STATUS_OPTIONS_BY_TYPE[form.type] || STATUS_OPTIONS_BY_TYPE[AGENDA_EVENT_TYPES.COMPROMISSO]
  }, [form.type])

  const showAmount =
    form.type === AGENDA_EVENT_TYPES.CONTA_PAGAR || form.type === AGENDA_EVENT_TYPES.CONTA_RECEBER

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const title = String(form.title || '').trim()
    if (!title) {
      setError('Informe o título.')
      return
    }
    setSaving(true)
    try {
      let startAt
      let endAt
      if (form.allDay) {
        const ds = (form.startLocal || '').slice(0, 10)
        const de = (form.endLocal || form.startLocal || '').slice(0, 10)
        startAt = new Date(`${ds}T12:00:00`).toISOString()
        endAt = new Date(`${de || ds}T12:00:00`).toISOString()
      } else {
        startAt = fromDatetimeLocalValue(form.startLocal)
        endAt = form.endLocal ? fromDatetimeLocalValue(form.endLocal) : startAt
      }
      if (new Date(endAt) < new Date(startAt)) endAt = startAt

      let amountVal = null
      if (showAmount && form.amount !== '') {
        const parsed = Number.parseFloat(String(form.amount).replace(',', '.'))
        amountVal = Number.isFinite(parsed) ? parsed : null
      }

      const payload = {
        title,
        description: String(form.description || '').trim(),
        type: form.type,
        category: String(form.category || '').trim(),
        subcategory: String(form.subcategory || '').trim(),
        startAt,
        endAt,
        allDay: Boolean(form.allDay),
        location: String(form.location || '').trim(),
        notes: String(form.notes || '').trim(),
        amount: amountVal,
        status: form.status,
        priority: form.priority,
        recurrence: form.recurrence,
        reminder: form.reminder,
        color: form.color || '#64748b',
        linkedTransactionId: form.linkedTransactionId?.trim() || null,
      }

      await onSubmit(payload)
      onClose()
    } catch (err) {
      setError(err?.message || 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="agenda-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="agenda-modal ref-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-modal-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="agenda-modal__head ref-panel__head">
          <h2 id="agenda-modal-title" className="ref-panel__title">
            {isEdit ? 'Editar evento' : 'Novo evento'}
          </h2>
          <button type="button" className="agenda-modal__close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <form className="agenda-modal__form" onSubmit={handleSubmit}>
          {error ? (
            <div className="ref-alert agenda-modal__alert" role="alert">
              {error}
            </div>
          ) : null}

          <label className="agenda-field">
            <span>Título *</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              autoComplete="off"
            />
          </label>

          <label className="agenda-field">
            <span>Tipo</span>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, status: 'pendente' }))}>
              {Object.entries(AGENDA_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="agenda-field">
            <span>Descrição</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>

          <div className="agenda-field-row">
            <label className="agenda-field">
              <span>Categoria</span>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </label>
            <label className="agenda-field">
              <span>Subcategoria</span>
              <input
                type="text"
                value={form.subcategory}
                onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
              />
            </label>
          </div>

          <label className="agenda-field agenda-field--check">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
            />
            <span>Dia inteiro</span>
          </label>

          <div className="agenda-field-row">
            <label className="agenda-field">
              <span>Início *</span>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={
                  form.allDay
                    ? (form.startLocal || '').slice(0, 10)
                    : form.startLocal
                }
                onChange={(e) => {
                  const v = e.target.value
                  setForm((f) => ({
                    ...f,
                    startLocal: f.allDay ? `${v}T12:00` : v,
                  }))
                }}
                required
              />
            </label>
            <label className="agenda-field">
              <span>Fim</span>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={
                  form.allDay
                    ? (form.endLocal || form.startLocal || '').slice(0, 10)
                    : form.endLocal
                }
                onChange={(e) => {
                  const v = e.target.value
                  setForm((f) => ({
                    ...f,
                    endLocal: f.allDay ? `${v}T12:00` : v,
                  }))
                }}
              />
            </label>
          </div>

          {showAmount ? (
            <label className="agenda-field">
              <span>Valor (R$)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
          ) : null}

          <label className="agenda-field">
            <span>Local</span>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </label>

          <label className="agenda-field">
            <span>Observações</span>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>

          <div className="agenda-field-row">
            <label className="agenda-field">
              <span>Status</span>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {AGENDA_STATUS_LABELS[s] || s}
                  </option>
                ))}
              </select>
            </label>
            <label className="agenda-field">
              <span>Prioridade</span>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                {Object.entries(AGENDA_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="agenda-field-row">
            <label className="agenda-field">
              <span>Recorrência</span>
              <select value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))}>
                {Object.entries(AGENDA_RECURRENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="agenda-field">
              <span>Lembrete</span>
              <select value={form.reminder} onChange={(e) => setForm((f) => ({ ...f, reminder: e.target.value }))}>
                {Object.entries(AGENDA_REMINDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="agenda-field">
            <span>Cor do evento</span>
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
          </label>

          <label className="agenda-field">
            <span>ID transação vinculada (futuro)</span>
            <input
              type="text"
              value={form.linkedTransactionId}
              onChange={(e) => setForm((f) => ({ ...f, linkedTransactionId: e.target.value }))}
              placeholder="UUID opcional"
            />
          </label>

          <div className="agenda-modal__actions">
            {isEdit && onDelete ? (
              <button type="button" className="btn-secondary agenda-modal__delete" onClick={() => onDelete(event.id)}>
                Excluir
              </button>
            ) : (
              <span />
            )}
            <div className="agenda-modal__actions-right">
              {isEdit && onDuplicate ? (
                <button type="button" className="btn-secondary" onClick={() => onDuplicate(event)}>
                  Duplicar
                </button>
              ) : null}
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="ref-empty-cta" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

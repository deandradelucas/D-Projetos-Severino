import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import ConfirmDialog from '../components/ConfirmDialog'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { redirectSe401 } from '../lib/authRedirect'
import { readHorizonteUser } from '../lib/horizonteSession'
import { showToast } from '../lib/toastStore'
import { useSheetDragClose } from '../hooks/useSheetDragClose'
import {
  SAO_PAULO_OFFSET,
  saoPauloDateKey,
  toDatetimeLocal,
  localToIso,
  formatDate,
  formatTime,
  isToday,
  dateKeyToDate,
  dateKeyToMonthKey,
  monthKeyToDate,
  addMonths,
  buildMonthCalendar,
  buildWeekDays,
  getWeekRange,
  agendaItemKind,
} from '../lib/agendaDateUtils'
import { AgendaCalendarPanel } from '../components/agenda/AgendaCalendarPanel'
import { AgendaDayList } from '../components/agenda/AgendaDayList'

const EMPTY_FORM = {
  titulo: '',
  inicio: '',
  fim: '',
  lembrar_minutos_antes: 15,
  whatsapp_notificar: true,
}

const STATUS_LABEL = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
}


export default function Agenda() {
  const [usuario] = useState(() => readHorizonteUser())
  const [menuAberto, setMenuAberto] = useState(false)
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const editingRef = useRef(null)
  const agendaSheetRef = useRef(null)
  const closeAgendaSheet = useCallback(() => { if (!savingRef.current) setModalOpen(false) }, [])
  useSheetDragClose(agendaSheetRef, { open: modalOpen, onClose: closeAgendaSheet })
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  /** Exclusão direta na lista do dia (confirmação em `ConfirmDialog`). */
  const [pendingDelete, setPendingDelete] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedDateKey, setSelectedDateKey] = useState(() => saoPauloDateKey(new Date()))
  const [calendarMonthKey, setCalendarMonthKey] = useState(() => saoPauloDateKey(new Date()).slice(0, 7))
  const [calendarView, setCalendarView] = useState('month')
  const [draggingEvent, setDraggingEvent] = useState(null)

  const usuarioId = usuario?.id ? String(usuario.id).trim() : ''

  const loadAgenda = useCallback(async () => {
    if (!usuarioId) return
    setLoading(true)
    setError('')
    try {
      const from = monthKeyToDate(calendarMonthKey)
      from.setDate(1)
      from.setDate(from.getDate() - 7)
      from.setHours(0, 0, 0, 0)
      const to = new Date(from)
      to.setMonth(to.getMonth() + 2)
      to.setDate(7)
      to.setHours(23, 59, 59, 999)
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      })
      const res = await apiFetch(apiUrl(`/api/agenda?${params.toString()}`), {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => [])
      if (redirectSe401(res)) return
      if (!res.ok) throw new Error(data?.message || 'Falha ao carregar agenda.')
      setEventos(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Falha ao carregar agenda.')
    } finally {
      setLoading(false)
    }
  }, [calendarMonthKey, usuarioId])

  useEffect(() => {
    void loadAgenda()
  }, [loadAgenda])

  useEffect(() => {
    if (!modalOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('horizon-modal-open')

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        setModalOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('horizon-modal-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [modalOpen, saving])

  const activeEventos = useMemo(
    () =>
      eventos
        .filter((ev) => ev.status !== 'CANCELADO')
        .slice()
        .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()),
    [eventos]
  )

  const eventosByDate = useMemo(() => {
    const map = new Map()
    for (const ev of activeEventos) {
      const key = saoPauloDateKey(ev.inicio)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(ev)
    }
    return map
  }, [activeEventos])

  const selectedEvents = useMemo(() => eventosByDate.get(selectedDateKey) || [], [eventosByDate, selectedDateKey])

  const calendarDays = useMemo(() => buildMonthCalendar(calendarMonthKey), [calendarMonthKey])

  const eventDateKeys = useMemo(() => new Set(eventosByDate.keys()), [eventosByDate])

  const eventDateKinds = useMemo(() => {
    const map = new Map()
    for (const [key, rows] of eventosByDate.entries()) {
      map.set(key, agendaItemKind(rows[0]))
    }
    return map
  }, [eventosByDate])

  const stats = useMemo(() => {
    const todayCount = activeEventos.filter((ev) => isToday(ev.inicio) && ev.status !== 'CONCLUIDO').length
    const { start, end } = getWeekRange(selectedDateKey)
    const weekCount = activeEventos.filter((ev) => {
      const date = new Date(ev.inicio)
      return ev.status !== 'CONCLUIDO' && date >= start && date <= end
    }).length
    return {
      selectedDay: selectedEvents.filter((ev) => ev.status !== 'CONCLUIDO').length,
      today: todayCount,
      week: weekCount,
      reminders: selectedEvents.filter((ev) => agendaItemKind(ev) === 'reminder').length,
    }
  }, [activeEventos, selectedDateKey, selectedEvents])

  const nextEvento = useMemo(
    () => activeEventos.find((ev) => ev.status !== 'CONCLUIDO' && new Date(ev.inicio) >= new Date()) || null,
    [activeEventos]
  )

  // Mini-agenda da semana (feature 1) + visão semanal (feature 10)
  const weekDays = useMemo(() => buildWeekDays(selectedDateKey), [selectedDateKey])
  const weekDaysComContagem = useMemo(
    () =>
      weekDays.map((d) => ({
        ...d,
        count: (eventosByDate.get(d.key) || []).filter((ev) => ev.status !== 'CONCLUIDO').length,
        selected: d.key === selectedDateKey,
      })),
    [weekDays, eventosByDate, selectedDateKey]
  )

  // Reagendar via drag-and-drop (feature 9): mantém o horário, troca a data.
  async function rescheduleEvent(evento, newDateKey) {
    if (!usuarioId || !evento?.id) return
    if (saoPauloDateKey(evento.inicio) === newDateKey) return
    const localOld = toDatetimeLocal(evento.inicio)
    const time = localOld.slice(11) || '09:00'
    const newIso = localToIso(`${newDateKey}T${time}`)
    if (!newIso) return
    // Atualização otimista
    setEventos((prev) => prev.map((ev) => (ev.id === evento.id ? { ...ev, inicio: newIso } : ev)))
    try {
      const payload = {
        titulo: evento.titulo,
        inicio: newIso,
        lembrar_minutos_antes: evento.lembrar_minutos_antes ?? 15,
        whatsapp_notificar: evento.whatsapp_notificar !== false,
      }
      const res = await apiFetch(apiUrl(`/api/agenda/${evento.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (redirectSe401(res)) return
      if (!res.ok) throw new Error(data.message || 'Falha ao reagendar.')
      showToast('Item reagendado.', 'success')
      await loadAgenda()
    } catch (err) {
      showToast(err.message || 'Falha ao reagendar.', 'error')
      await loadAgenda()
    } finally {
      setDraggingEvent(null)
    }
  }

  function goToMonth(amount) {
    setCalendarMonthKey((currentMonth) => {
      const nextMonth = addMonths(currentMonth, amount)
      setSelectedDateKey((currentDate) => {
        const currentDay = currentDate.slice(8, 10)
        const desired = new Date(`${nextMonth}-${currentDay}T12:00:00${SAO_PAULO_OFFSET}`)
        if (Number.isNaN(desired.getTime()) || saoPauloDateKey(desired).slice(0, 7) !== nextMonth) {
          return `${nextMonth}-01`
        }
        return saoPauloDateKey(desired)
      })
      return nextMonth
    })
  }

  function openNew() {
    const todayKey = saoPauloDateKey(new Date())
    const d = selectedDateKey === todayKey ? new Date() : dateKeyToDate(selectedDateKey)
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
    if (selectedDateKey !== todayKey) d.setHours(9, 0, 0, 0)
    editingRef.current = null
    setEditing(null)
    setForm({ ...EMPTY_FORM, inicio: toDatetimeLocal(d.toISOString()) })
    setModalOpen(true)
  }

  function openEdit(evento) {
    editingRef.current = evento
    setEditing(evento)
    setForm({
      titulo: evento.titulo || '',
      inicio: toDatetimeLocal(evento.inicio),
      fim: toDatetimeLocal(evento.fim),
      lembrar_minutos_antes: evento.lembrar_minutos_antes ?? 15,
      whatsapp_notificar: evento.whatsapp_notificar !== false,
    })
    setModalOpen(true)
  }

  async function saveEvent(e) {
    e.preventDefault()
    if (!usuarioId || savingRef.current) return
    // Bloqueia re-entrada imediatamente (antes de qualquer await ou render)
    savingRef.current = true
    setSaving(true)
    try {
      const eventoEmEdicao = editingRef.current ?? editing
      const eventoId = eventoEmEdicao?.id ? String(eventoEmEdicao.id).trim() : ''
      const isEdit = Boolean(eventoId)

      const inicioIso = localToIso(form.inicio)
      if (!inicioIso) {
        showToast('Informe uma data e hora válidas.', 'error')
        return
      }

      const payload = {
        titulo: form.titulo.trim(),
        inicio: inicioIso,
        lembrar_minutos_antes: Number(form.lembrar_minutos_antes),
        whatsapp_notificar: form.whatsapp_notificar !== false,
      }
      const fimIso = form.fim ? localToIso(form.fim) : ''
      if (fimIso) payload.fim = fimIso

      const res = await apiFetch(apiUrl(isEdit ? `/api/agenda/${eventoId}` : '/api/agenda'), {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (redirectSe401(res)) return
      if (!res.ok) throw new Error(data.message || 'Falha ao salvar item da agenda.')
      showToast(isEdit ? 'Item atualizado.' : 'Item criado.', 'success')
      setModalOpen(false)
      editingRef.current = null
      setEditing(null)
      await loadAgenda()
    } catch (err) {
      showToast(err.message || 'Falha ao salvar item da agenda.', 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function removeAgendaItem(id) {
    if (!usuarioId || !id) throw new Error('Sessão inválida.')
    const res = await apiFetch(apiUrl(`/api/agenda/${id}`), {
      method: 'DELETE',
    })
    const data = await res.json().catch(() => ({}))
    if (redirectSe401(res)) return
    if (!res.ok) throw new Error(data.message || 'Falha ao remover item da agenda.')
  }

  async function deleteEvent() {
    if (!usuarioId || !editing?.id || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      await removeAgendaItem(editing.id)
      showToast('Item removido.', 'success')
      setModalOpen(false)
      setEditing(null)
      setConfirmDeleteOpen(false)
      await loadAgenda()
    } catch (err) {
      showToast(err.message || 'Falha ao remover item da agenda.', 'error')
      throw err
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function confirmDeleteFromList() {
    const id = pendingDelete?.id
    if (!id || !usuarioId) return
    await removeAgendaItem(id)
    showToast('Item removido.', 'success')
    await loadAgenda()
  }

  async function setStatus(evento, status) {
    if (!usuarioId) return
    try {
      const res = await apiFetch(apiUrl(`/api/agenda/${evento.id}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (redirectSe401(res)) return
      if (!res.ok) throw new Error(data.message || 'Falha ao atualizar status.')
      showToast('Status atualizado.', 'success')
      await loadAgenda()
    } catch (err) {
      showToast(err.message || 'Falha ao atualizar status.', 'error')
    }
  }

  return (
    <>
    <div className="dashboard-container dashboard-page agenda-page ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub agenda-shell">
            <RefDashboardScroll>
              <section className="dashboard-hub__hero agenda-hero" aria-label="Agenda e lembretes">
                <span className="agenda-hero__orb agenda-hero__orb--one" aria-hidden="true" />
                <span className="agenda-hero__orb agenda-hero__orb--two" aria-hidden="true" />
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                  <div className="agenda-hero__title">
                    <div className="agenda-hero__title-row">
                      <strong>Agenda</strong>
                      <div className="agenda-hero__stats" aria-label="Resumo de compromissos">
                        <div className="agenda-hero__stat">
                          <span>Hoje</span>
                          <strong>{stats.selectedDay}</strong>
                        </div>
                        <div className="agenda-hero__stat">
                          <span>Semana</span>
                          <strong>{stats.week}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Ações da agenda">
                    <button type="button" className="dashboard-hub__btn dashboard-hub__btn--primary" onClick={openNew}>
                      + Novo
                    </button>
                  </div>
                </div>
                <div className="agenda-hero__summary">
                  {nextEvento ? (
                    <p>Próximo: {nextEvento.titulo} · {formatDate(nextEvento.inicio)} às {formatTime(nextEvento.inicio)}</p>
                  ) : (
                    <p>Sem próximos compromissos ativos.</p>
                  )}
                </div>

                {/* Mini-agenda da semana (feature 1) */}
                <div className="agenda-hero__week" role="group" aria-label="Resumo da semana">
                  {weekDaysComContagem.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      className={[
                        'agenda-hero__week-day',
                        d.selected ? 'agenda-hero__week-day--selected' : '',
                        d.isToday ? 'agenda-hero__week-day--today' : '',
                        d.count > 0 ? 'agenda-hero__week-day--has' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        setSelectedDateKey(d.key)
                        setCalendarMonthKey(dateKeyToMonthKey(d.key))
                      }}
                      aria-pressed={d.selected}
                      aria-label={`${d.weekday} dia ${d.day}, ${d.count} ${d.count === 1 ? 'item' : 'itens'}`}
                    >
                      <span className="agenda-hero__week-wd">{d.weekday}</span>
                      <span className="agenda-hero__week-num">{d.day}</span>
                      <span className="agenda-hero__week-count">{d.count > 0 ? d.count : ''}</span>
                    </button>
                  ))}
                </div>
              </section>

              <AgendaCalendarPanel
                calendarDays={calendarDays}
                weekDays={weekDaysComContagem}
                view={calendarView}
                onChangeView={setCalendarView}
                selectedDateKey={selectedDateKey}
                eventsByDate={eventosByDate}
                eventDateKeys={eventDateKeys}
                eventDateKinds={eventDateKinds}
                calendarMonthKey={calendarMonthKey}
                statsToday={stats.today}
                statsReminders={stats.reminders}
                draggingEvent={draggingEvent}
                onDropDay={(dateKey) => {
                  if (draggingEvent) rescheduleEvent(draggingEvent, dateKey)
                }}
                onSelectDay={(dateKey) => {
                  setSelectedDateKey(dateKey)
                  setCalendarMonthKey(dateKeyToMonthKey(dateKey))
                }}
                onNavigateMonth={goToMonth}
              />

              <AgendaDayList
                selectedEvents={selectedEvents}
                loading={loading}
                error={error}
                selectedDateKey={selectedDateKey}
                onOpenNew={openNew}
                onEdit={openEdit}
                onSetStatus={setStatus}
                onDelete={setPendingDelete}
                onDragStartEvent={setDraggingEvent}
                onDragEndEvent={() => setDraggingEvent(null)}
              />
            </RefDashboardScroll>
          </div>
        </main>
      </div>

      {modalOpen && createPortal(
        <div
          className="modal-backdrop agenda-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setModalOpen(false)
          }}
        >
          <form
            className="agenda-modal"
            ref={agendaSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Editar item da agenda' : 'Novo item da agenda'}
            onSubmit={saveEvent}
          >
            <div className="agenda-modal__header">
              <div>
                <span className="agenda-section-eyebrow">{editing ? 'Editar item' : 'Novo item'}</span>
                <h2>{editing ? 'Atualizar agenda' : 'Criar item na agenda'}</h2>
              </div>
              <button type="button" className="agenda-modal__close" onClick={() => setModalOpen(false)} aria-label="Fechar"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg></button>
            </div>

            <label className="agenda-field">
              <span>Título</span>
              <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} required maxLength={160} placeholder="Ex.: reunião com cliente" />
            </label>
            <label className="agenda-field">
              <span>Data e hora</span>
              <input type="datetime-local" value={form.inicio} onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))} required />
            </label>
            <div className="agenda-modal__grid">
              <label className="agenda-field">
                <span>Aviso de notificação</span>
                <select value={form.lembrar_minutos_antes} onChange={(e) => setForm((f) => ({ ...f, lembrar_minutos_antes: Number(e.target.value) }))}>
                  <option value={0}>Na hora</option>
                  <option value={5}>5 min antes</option>
                  <option value={10}>10 min antes</option>
                  <option value={15}>15 min antes</option>
                  <option value={30}>30 min antes</option>
                  <option value={60}>1 hora antes</option>
                </select>
              </label>
              <label className="agenda-toggle">
                <input type="checkbox" checked={form.whatsapp_notificar} onChange={(e) => setForm((f) => ({ ...f, whatsapp_notificar: e.target.checked }))} />
                <span>Notificar via WhatsApp</span>
              </label>
            </div>

            <div className="agenda-modal__actions">
              <span aria-hidden="true" />
              <div className="agenda-modal__actions-main">
                <button type="button" className="agenda-secondary-btn" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
                <button type="submit" className="dashboard-hub__btn dashboard-hub__btn--primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar item'}
                </button>
              </div>
            </div>
          </form>
        </div>,
        document.body,
      )}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Remover item?"
        message={`"${editing?.titulo || 'Este item'}" será removido da agenda.`}
        confirmLabel="Remover"
        onConfirm={deleteEvent}
        onClose={() => setConfirmDeleteOpen(false)}
      />
      <ConfirmDialog
        open={pendingDelete != null}
        title="Remover item?"
        message={`"${pendingDelete?.titulo || 'Este item'}" será removido da agenda.`}
        confirmLabel="Remover"
        onConfirm={confirmDeleteFromList}
        onClose={() => setPendingDelete(null)}
      />
    </div>

    {!modalOpen && (
      <button
        type="button"
        className="dashboard-mobile-tx-fab"
        onClick={openNew}
        aria-label="Criar novo item na agenda"
      >
        <span className="dashboard-mobile-tx-fab__icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </span>
        <span className="dashboard-mobile-tx-fab__label">Nova agenda</span>
      </button>
    )}
    </>
  )
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import ConfirmDialog from '../components/ConfirmDialog'
import { apiUrl } from '../lib/apiUrl'
import { horizonteApiAuthHeaders } from '../lib/apiAuthHeaders'
import { readHorizonteUser } from '../lib/horizonteSession'
import { showToast } from '../lib/toastStore'
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
  formatCompactDate,
  buildMonthCalendar,
  getWeekRange,
  agendaItemKind,
} from '../lib/agendaDateUtils'
import { AgendaCalendarPanel } from '../components/agenda/AgendaCalendarPanel'
import { AgendaDayList } from '../components/agenda/AgendaDayList'

const EMPTY_FORM = {
  titulo: '',
  descricao: '',
  local: '',
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  /** Exclusão direta na lista do dia (confirmação em `ConfirmDialog`). */
  const [pendingDelete, setPendingDelete] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedDateKey, setSelectedDateKey] = useState(() => saoPauloDateKey(new Date()))
  const [calendarMonthKey, setCalendarMonthKey] = useState(() => saoPauloDateKey(new Date()).slice(0, 7))

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
      const res = await fetch(apiUrl(`/api/agenda?${params.toString()}`), {
        headers: horizonteApiAuthHeaders(),
        cache: 'no-store',
      })
      const data = await res.json().catch(() => [])
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
    setEditing(null)
    setForm({ ...EMPTY_FORM, inicio: toDatetimeLocal(d.toISOString()) })
    setModalOpen(true)
  }

  function openEdit(evento) {
    setEditing(evento)
    setForm({
      titulo: evento.titulo || '',
      descricao: evento.descricao || '',
      local: evento.local || '',
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
    savingRef.current = true
    setSaving(true)
    try {
      const payload = {
        ...form,
        inicio: localToIso(form.inicio),
        fim: form.fim ? localToIso(form.fim) : null,
        lembrar_minutos_antes: Number(form.lembrar_minutos_antes),
      }
      const res = await fetch(apiUrl(editing ? `/api/agenda/${editing.id}` : '/api/agenda'), {
        method: editing ? 'PUT' : 'POST',
        headers: horizonteApiAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Falha ao salvar item da agenda.')
      showToast(editing ? 'Item atualizado.' : 'Item criado.', 'success')
      setModalOpen(false)
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
    const res = await fetch(apiUrl(`/api/agenda/${id}`), {
      method: 'DELETE',
      headers: horizonteApiAuthHeaders(),
    })
    const data = await res.json().catch(() => ({}))
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
      const res = await fetch(apiUrl(`/api/agenda/${evento.id}/status`), {
        method: 'PATCH',
        headers: horizonteApiAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Falha ao atualizar status.')
      showToast('Status atualizado.', 'success')
      await loadAgenda()
    } catch (err) {
      showToast(err.message || 'Falha ao atualizar status.', 'error')
    }
  }

  return (
    <div className="dashboard-container agenda-page ref-dashboard app-horizon-shell">
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
                    <span>{formatCompactDate(selectedDateKey)}</span>
                    <strong>Agenda</strong>
                  </div>
                  <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Ações da agenda">
                    <button type="button" className="dashboard-hub__btn dashboard-hub__btn--primary" onClick={openNew}>
                      + Novo
                    </button>
                  </div>
                </div>
                <div className="agenda-hero__summary" aria-label="Resumo de compromissos">
                  <div>
                    <span>Hoje</span>
                    <strong>{stats.selectedDay}</strong>
                  </div>
                  <div>
                    <span>Semana</span>
                    <strong>{stats.week}</strong>
                  </div>
                  {nextEvento ? (
                    <p>Próximo: {nextEvento.titulo} · {formatDate(nextEvento.inicio)} às {formatTime(nextEvento.inicio)}</p>
                  ) : (
                    <p>Sem próximos compromissos ativos.</p>
                  )}
                </div>
              </section>

              <AgendaCalendarPanel
                calendarDays={calendarDays}
                selectedDateKey={selectedDateKey}
                eventDateKeys={eventDateKeys}
                eventDateKinds={eventDateKinds}
                calendarMonthKey={calendarMonthKey}
                statsToday={stats.today}
                statsReminders={stats.reminders}
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
              />
            </RefDashboardScroll>
          </div>
        </main>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editing ? 'Editar item da agenda' : 'Novo item da agenda'}>
          <form className="agenda-modal" onSubmit={saveEvent}>
            <div className="agenda-modal__header">
              <div>
                <span className="agenda-section-eyebrow">{editing ? 'Editar item' : 'Novo item'}</span>
                <h2>{editing ? 'Atualizar agenda' : 'Criar item na agenda'}</h2>
              </div>
              <button type="button" className="agenda-modal__close" onClick={() => setModalOpen(false)} aria-label="Fechar">×</button>
            </div>

            <label className="agenda-field">
              <span>Título</span>
              <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} required maxLength={160} placeholder="Ex.: reunião com cliente" />
            </label>
            <label className="agenda-field">
              <span>Data e hora</span>
              <input type="datetime-local" value={form.inicio} onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))} required />
            </label>
            <label className="agenda-field">
              <span>Local</span>
              <input value={form.local} onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))} maxLength={180} placeholder="Ex.: Zoom, escritório, clínica" />
            </label>
            <label className="agenda-field">
              <span>Descrição</span>
              <textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} rows={3} placeholder="Notas rápidas para lembrar antes do compromisso" />
            </label>

            <div className="agenda-modal__grid">
              <label className="agenda-field">
                <span>Aviso de notificação</span>
                <select value={form.lembrar_minutos_antes} onChange={(e) => setForm((f) => ({ ...f, lembrar_minutos_antes: e.target.value }))}>
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
              {editing ? (
                <button type="button" className="agenda-danger-btn" onClick={() => setConfirmDeleteOpen(true)} disabled={saving}>
                  Remover
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
              <div className="agenda-modal__actions-main">
                <button type="button" className="agenda-secondary-btn" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
                <button type="submit" className="dashboard-hub__btn dashboard-hub__btn--primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar item'}
                </button>
              </div>
            </div>
          </form>
        </div>
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
  )
}

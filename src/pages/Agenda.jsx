import React, { useCallback, useEffect, useMemo, useState } from 'react'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { apiUrl } from '../lib/apiUrl'
import { readHorizonteUser } from '../lib/horizonteSession'
import { showToast } from '../lib/toastStore'

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

const AGENDA_TIME_ZONE = 'America/Sao_Paulo'
const SAO_PAULO_OFFSET = '-03:00'

function saoPauloParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AGENDA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

function saoPauloDateKey(isoOrDate) {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  const parts = saoPauloParts(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = saoPauloParts(d)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

function localToIso(value) {
  if (!value) return ''
  const normalized = value.length === 16 ? `${value}:00${SAO_PAULO_OFFSET}` : `${value}${SAO_PAULO_OFFSET}`
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

function capitalizeDateLabel(value) {
  return value
    .replace('.', '')
    .replace(/(^|,\s*|\s+de\s+)(\p{L})/gu, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`)
}

function formatDate(iso) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(iso))
  return capitalizeDateLabel(formatted)
}

function formatTime(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatReminder(minutes) {
  const n = Number.parseInt(String(minutes ?? 0), 10)
  if (!Number.isFinite(n) || n <= 0) return 'Na hora'
  return `${n} min`
}

function plural(count, singular, pluralText) {
  return `${count} ${count === 1 ? singular : pluralText}`
}

function isToday(iso) {
  return saoPauloDateKey(iso) === saoPauloDateKey(new Date())
}

function eventTone(status) {
  if (status === 'CONFIRMADO') return 'confirmed'
  if (status === 'CONCLUIDO') return 'done'
  if (status === 'CANCELADO') return 'cancelled'
  return 'scheduled'
}

function dateKeyToDate(dateKey) {
  return new Date(`${dateKey}T12:00:00${SAO_PAULO_OFFSET}`)
}

function dateKeyToMonthKey(dateKey) {
  return dateKey.slice(0, 7)
}

function monthKeyToDate(monthKey) {
  return new Date(`${monthKey}-01T12:00:00${SAO_PAULO_OFFSET}`)
}

function addMonths(monthKey, amount) {
  const date = monthKeyToDate(monthKey)
  date.setMonth(date.getMonth() + amount)
  return saoPauloDateKey(date).slice(0, 7)
}

function formatMonthTitle(monthKey) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  }).format(monthKeyToDate(monthKey))
  return capitalizeDateLabel(formatted)
}

function formatSelectedDayTitle(dateKey) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    day: '2-digit',
    month: 'long',
    weekday: 'long',
  }).format(dateKeyToDate(dateKey))
  return capitalizeDateLabel(formatted)
}

function formatCompactDate(dateKey) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    day: '2-digit',
    month: 'long',
  }).format(dateKeyToDate(dateKey))
  return capitalizeDateLabel(formatted)
}

function buildMonthCalendar(monthKey) {
  const first = monthKeyToDate(monthKey)
  const month = first.getMonth()
  const firstDay = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - firstDay)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = saoPauloDateKey(date)
    return {
      key,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
    }
  })
}

function getWeekRange(dateKey) {
  const date = dateKeyToDate(dateKey)
  const start = new Date(date)
  const mondayOffset = (date.getDay() + 6) % 7
  start.setDate(date.getDate() - mondayOffset)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function isReminderEvent(evento) {
  const text = `${evento.titulo || ''} ${evento.descricao || ''}`.toLowerCase()
  return /\b(lembra|lembrete|avise|alerte|notifica[cç][aã]o|pagar|tomar|ligar|renovar|buscar|comprar)\b/.test(text)
    || /^(quando for|notifica[cç][aã]o)$/i.test(String(evento.titulo || '').trim())
}

function isMilestoneEvent(evento) {
  const text = `${evento.titulo || ''} ${evento.descricao || ''}`.toLowerCase()
  return /\b(marco|milestone|entrega|prazo|vencimento)\b/.test(text)
}

function agendaItemKind(evento) {
  if (evento.status === 'CONCLUIDO') return 'done'
  if (isReminderEvent(evento)) return 'reminder'
  if (isMilestoneEvent(evento)) return 'milestone'
  return 'event'
}

const AGENDA_KIND_META = {
  event: { label: 'Compromisso', icon: 'calendar', tone: 'event' },
  reminder: { label: 'Notificação', icon: 'bell', tone: 'reminder' },
  milestone: { label: 'Marco', icon: 'flag', tone: 'milestone' },
  done: { label: 'Concluído', icon: 'check', tone: 'done' },
}

function formatAgendaItemTime(evento, kind) {
  if (kind === 'reminder') return `Aviso de notificação às ${formatTime(evento.inicio)}`
  return [
    formatTime(evento.inicio),
    evento.fim ? ` - ${formatTime(evento.fim)}` : '',
    ' · lembrete ',
    formatReminder(evento.lembrar_minutos_antes),
  ].join('')
}

function AgendaKindIcon({ type }) {
  if (type === 'flag') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 22V4" />
        <path d="M4 4h12l-1 4 1 4H4" />
      </svg>
    )
  }
  if (type === 'bell') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    )
  }
  if (type === 'check') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
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
        headers: { 'x-user-id': usuarioId },
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
    if (!usuarioId) return
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': usuarioId,
        },
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
      setSaving(false)
    }
  }

  async function setStatus(evento, status) {
    if (!usuarioId) return
    try {
      const res = await fetch(apiUrl(`/api/agenda/${evento.id}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': usuarioId,
        },
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
                  <MobileMenuButton onClick={() => setMenuAberto(true)} />
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
                    <span>Itens do dia</span>
                    <strong>{stats.selectedDay}</strong>
                  </div>
                  <div>
                    <span>Nesta semana</span>
                    <strong>{stats.week}</strong>
                  </div>
                  {nextEvento ? (
                    <p>Próximo: {nextEvento.titulo} · {formatDate(nextEvento.inicio)} às {formatTime(nextEvento.inicio)}</p>
                  ) : (
                    <p>Sem próximos compromissos ativos.</p>
                  )}
                </div>
              </section>

              <section className="agenda-calendar-panel" aria-label="Calendário da agenda">
                <div className="agenda-calendar-head">
                  <div>
                    <strong>{formatMonthTitle(calendarMonthKey)}</strong>
                    <span>
                      {plural(stats.today, 'item hoje', 'itens hoje')} · {plural(stats.reminders, 'notificação', 'notificações')} no dia
                    </span>
                  </div>
                  <div className="agenda-calendar-nav" aria-label="Navegar meses">
                    <button type="button" onClick={() => goToMonth(-1)} aria-label="Mês anterior">
                      ‹
                    </button>
                    <button type="button" onClick={() => goToMonth(1)} aria-label="Próximo mês">
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
                          setSelectedDateKey(day.key)
                          setCalendarMonthKey(dateKeyToMonthKey(day.key))
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

              <section className="agenda-list-panel agenda-list-panel--daily" aria-label="Lista do dia selecionado">
                <div className="agenda-list-panel__header">
                  <div>
                    <span className="agenda-section-eyebrow">Agenda do dia</span>
                    <h2>{formatSelectedDayTitle(selectedDateKey)}</h2>
                  </div>
                  <button type="button" className="agenda-floating-add" onClick={openNew} aria-label="Adicionar compromisso ou notificação">+</button>
                </div>

                {loading ? (
                  <div className="agenda-empty">Carregando agenda...</div>
                ) : error ? (
                  <div className="agenda-empty agenda-empty--error">{error}</div>
                ) : selectedEvents.length === 0 ? (
                  <div className="agenda-empty">
                    <strong>Nenhum item neste dia.</strong>
                    <span>Toque no + para criar um item ou peça pelo WhatsApp: “me avise de pagar a luz amanhã às 9h”.</span>
                  </div>
                ) : (
                  <div className="agenda-daily-list">
                    {selectedEvents.map((evento) => {
                      const kind = agendaItemKind(evento)
                      const meta = AGENDA_KIND_META[kind]
                      return (
                        <article className={`agenda-day-item agenda-day-item--${meta.tone} agenda-event--${eventTone(evento.status)}`} key={evento.id}>
                          <div className="agenda-day-item__icon" aria-hidden="true">
                            <AgendaKindIcon type={meta.icon} />
                          </div>
                          <div className="agenda-day-item__main">
                            <span className="agenda-day-item__type">{meta.label}</span>
                            <h3>{evento.titulo}</h3>
                            <p>{formatAgendaItemTime(evento, kind)}</p>
                            {evento.local ? <p className="agenda-event__local">{evento.local}</p> : null}
                          </div>
                          <div className="agenda-day-item__actions">
                            <button type="button" onClick={() => openEdit(evento)} aria-label={`Editar ${evento.titulo}`}>Editar</button>
                            <button type="button" onClick={() => setStatus(evento, 'CONCLUIDO')} aria-label={`Concluir ${evento.titulo}`}>Concluir</button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
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
              <button type="button" className="agenda-secondary-btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="dashboard-hub__btn dashboard-hub__btn--primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar item'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

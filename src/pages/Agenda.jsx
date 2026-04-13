import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import { useTheme } from '../context/ThemeContext'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import {
  listAgendaEvents,
  createAgendaEvent,
  updateAgendaEvent,
  deleteAgendaEvent,
  getAgendaSummary,
} from '../lib/agendaService'
import {
  AGENDA_VIEW_MODES,
  AGENDA_TYPE_LABELS,
  AGENDA_STATUS_LABELS,
  AGENDA_PRIORITY_LABELS,
  AGENDA_EVENT_TYPES,
} from '../lib/agendaConstants'
import { buildMonthGrid, addMonths, addDays, weekRange, toDateKey, cloneDate } from '../lib/agendaDateUtils'
import AgendaEventModal from '../components/agenda/AgendaEventModal'
import './dashboard.css'
import './agenda.css'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function applyAgendaFilters(events, { busca, tipo, status, prioridade, dataInicio, dataFim }) {
  return events.filter((ev) => {
    if (busca) {
      const q = busca.toLowerCase()
      const t = `${ev.title || ''} ${ev.description || ''}`.toLowerCase()
      if (!t.includes(q)) return false
    }
    if (tipo && ev.type !== tipo) return false
    if (status && ev.status !== status) return false
    if (prioridade && ev.priority !== prioridade) return false
    const ts = new Date(ev.startAt).getTime()
    if (dataInicio && ts < new Date(dataInicio + 'T00:00:00').getTime()) return false
    if (dataFim && ts > new Date(dataFim + 'T23:59:59').getTime()) return false
    return true
  })
}

function sortByStart(a, b) {
  return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
}

export default function Agenda() {
  const { privacyMode } = useTheme()
  const [menuAberto, setMenuAberto] = useState(false)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(AGENDA_VIEW_MODES.MONTH)
  const [cursorDate, setCursorDate] = useState(() => new Date())
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(new Date()))
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [filtroInicio, setFiltroInicio] = useState('')
  const [filtroFim, setFiltroFim] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listAgendaEvents()
      setEvents(Array.isArray(list) ? list : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(
    () =>
      applyAgendaFilters(events, {
        busca,
        tipo: filtroTipo,
        status: filtroStatus,
        prioridade: filtroPrioridade,
        dataInicio: filtroInicio,
        dataFim: filtroFim,
      }),
    [events, busca, filtroTipo, filtroStatus, filtroPrioridade, filtroInicio, filtroFim]
  )

  const summary = useMemo(() => getAgendaSummary(events), [events])

  const eventsByDate = useMemo(() => {
    const m = {}
    for (const ev of filtered) {
      const k = toDateKey(new Date(ev.startAt))
      if (!m[k]) m[k] = []
      m[k].push(ev)
    }
    for (const k of Object.keys(m)) m[k].sort(sortByStart)
    return m
  }, [filtered])

  const monthLabel = useMemo(() => {
    return cursorDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }, [cursorDate])

  const weekLabel = useMemo(() => {
    const { start, end } = weekRange(cursorDate)
    const a = start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    const b = end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    return `${a} – ${b}`
  }, [cursorDate])

  const dayLabel = useMemo(() => {
    return cursorDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [cursorDate])

  const gridCells = useMemo(() => buildMonthGrid(cursorDate), [cursorDate])

  const weekDays = useMemo(() => {
    const { start } = weekRange(cursorDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [cursorDate])

  const listRows = useMemo(() => [...filtered].sort(sortByStart), [filtered])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return [...filtered]
      .filter((e) => new Date(e.startAt).getTime() >= now - 86400000)
      .sort(sortByStart)
      .slice(0, 12)
  }, [filtered])

  const selectedDayEvents = eventsByDate[selectedKey] || []

  const goHoje = () => {
    const t = new Date()
    setCursorDate(t)
    setSelectedKey(toDateKey(t))
  }

  const setViewMode = (mode) => {
    if (mode === AGENDA_VIEW_MODES.DAY) {
      const d = new Date(`${selectedKey}T12:00:00`)
      setCursorDate(Number.isNaN(d.getTime()) ? new Date() : d)
    }
    setView(mode)
  }

  useEffect(() => {
    if (view !== AGENDA_VIEW_MODES.DAY) return
    setSelectedKey(toDateKey(cursorDate))
  }, [cursorDate, view])

  const prevPeriod = () => {
    if (view === AGENDA_VIEW_MODES.MONTH) setCursorDate((d) => addMonths(d, -1))
    else if (view === AGENDA_VIEW_MODES.WEEK) setCursorDate((d) => addDays(d, -7))
    else if (view === AGENDA_VIEW_MODES.DAY) setCursorDate((d) => addDays(d, -1))
    else setCursorDate((d) => addMonths(d, -1))
  }

  const nextPeriod = () => {
    if (view === AGENDA_VIEW_MODES.MONTH) setCursorDate((d) => addMonths(d, 1))
    else if (view === AGENDA_VIEW_MODES.WEEK) setCursorDate((d) => addDays(d, 7))
    else if (view === AGENDA_VIEW_MODES.DAY) setCursorDate((d) => addDays(d, 1))
    else setCursorDate((d) => addMonths(d, 1))
  }

  const openNew = (isoStart) => {
    if (isoStart) {
      setEditingEvent({
        startAt: isoStart,
        endAt: isoStart,
        type: AGENDA_EVENT_TYPES.COMPROMISSO,
        allDay: false,
      })
    } else {
      setEditingEvent(null)
    }
    setModalOpen(true)
  }

  const openEdit = (ev) => {
    setEditingEvent(ev)
    setModalOpen(true)
  }

  const handleSubmit = async (payload) => {
    if (editingEvent && editingEvent.id) {
      await updateAgendaEvent(editingEvent.id, payload)
    } else {
      await createAgendaEvent(payload)
    }
    await reload()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este evento?')) return
    await deleteAgendaEvent(id)
    setModalOpen(false)
    setEditingEvent(null)
    await reload()
  }

  const handleDuplicate = async (ev) => {
    if (!ev) return
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = ev
    await createAgendaEvent({
      ...rest,
      title: `${rest.title || 'Evento'} (cópia)`,
    })
    setModalOpen(false)
    setEditingEvent(null)
    await reload()
  }

  const quickStatus = async (id, status) => {
    await updateAgendaEvent(id, { status })
    await reload()
  }

  const limparFiltros = () => {
    setFiltroTipo('')
    setFiltroStatus('')
    setFiltroPrioridade('')
    setFiltroInicio('')
    setFiltroFim('')
    setBusca('')
  }

  const todayKey = toDateKey(new Date())

  const periodTitle =
    view === AGENDA_VIEW_MODES.MONTH
      ? monthLabel
      : view === AGENDA_VIEW_MODES.WEEK
        ? weekLabel
        : view === AGENDA_VIEW_MODES.DAY
          ? dayLabel
          : 'Lista de eventos'

  return (
    <>
      <div className="dashboard-container page-agenda app-horizon-shell">
        <div className="app-horizon-inner">
          <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

          <main className="main-content relative z-10 ref-dashboard-main">
            <div className="ref-dashboard-inner">
              <header className="ref-dashboard-header">
                <MobileMenuButton onClick={() => setMenuAberto(true)} />
                <div className="ref-dashboard-header__lead">
                  <h1 className="ref-dashboard-greeting">
                    <span className="ref-dashboard-greeting__name">Agenda</span>
                  </h1>
                  <p className="page-agenda__subtitle">Organize compromissos, vencimentos e lembretes</p>
                </div>
                <div className="ref-dashboard-header__actions page-agenda__header-actions">
                  <button type="button" className="ref-dashboard-header__btn-tx" onClick={() => openNew()}>
                    Novo evento
                  </button>
                </div>
              </header>

              <section className="ref-kpi-row ref-dashboard-kpi-strip page-agenda__summary" aria-label="Resumo da agenda">
                <article className="ref-kpi-card ref-kpi-card--balance">
                  <div className="ref-kpi-card__icon" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </div>
                  <div className="ref-kpi-card__body">
                    <p className="ref-kpi-card__label">Eventos hoje</p>
                    <p className="ref-kpi-card__value">{summary.todayCount}</p>
                  </div>
                </article>
                <article className="ref-kpi-card ref-kpi-card--expense">
                  <div className="ref-kpi-card__icon" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 2v4M16 2v4M3 10h18" />
                      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
                    </svg>
                  </div>
                  <div className="ref-kpi-card__body">
                    <p className="ref-kpi-card__label">Próximos 7 dias</p>
                    <p className="ref-kpi-card__value">{summary.next7DaysCount}</p>
                  </div>
                </article>
                <article className="ref-kpi-card page-agenda__kpi--pay">
                  <div className="ref-kpi-card__icon" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                  </div>
                  <div className="ref-kpi-card__body">
                    <p className="ref-kpi-card__label">A pagar</p>
                    <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>
                      {formatCurrencyBRL(summary.payableTotal)}
                    </p>
                  </div>
                </article>
                <article className="ref-kpi-card page-agenda__kpi--receive">
                  <div className="ref-kpi-card__icon" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </div>
                  <div className="ref-kpi-card__body">
                    <p className="ref-kpi-card__label">A receber</p>
                    <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>
                      {formatCurrencyBRL(summary.receivableTotal)}
                    </p>
                  </div>
                </article>
              </section>

              <div className="page-agenda__layout">
                <div className="page-agenda__main">
                  <div className="page-agenda__toolbar ref-panel">
                    <div className="page-agenda__toolbar-row">
                      <label className="page-agenda__search">
                        <span className="page-agenda__sr-only">Buscar</span>
                        <input
                          type="search"
                          placeholder="Buscar por título ou descrição…"
                          value={busca}
                          onChange={(e) => setBusca(e.target.value)}
                        />
                      </label>
                      <button type="button" className="btn-secondary" onClick={goHoje}>
                        Hoje
                      </button>
                      <div className="page-agenda__nav">
                        <button type="button" className="page-agenda__nav-btn" onClick={prevPeriod} aria-label="Período anterior">
                          ‹
                        </button>
                        <span className="page-agenda__period" aria-live="polite">
                          {periodTitle}
                        </span>
                        <button type="button" className="page-agenda__nav-btn" onClick={nextPeriod} aria-label="Próximo período">
                          ›
                        </button>
                      </div>
                    </div>
                    <div className="page-agenda__toolbar-row page-agenda__toolbar-views">
                      {[
                        [AGENDA_VIEW_MODES.MONTH, 'Mês'],
                        [AGENDA_VIEW_MODES.WEEK, 'Semana'],
                        [AGENDA_VIEW_MODES.DAY, 'Dia'],
                        [AGENDA_VIEW_MODES.LIST, 'Lista'],
                      ].map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          className={`page-agenda__view-btn ${view === mode ? 'page-agenda__view-btn--active' : ''}`}
                          onClick={() => setViewMode(mode)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loading ? (
                    <p className="page-agenda__loading">Carregando agenda…</p>
                  ) : (
                    <>
                      {view === AGENDA_VIEW_MODES.MONTH && (
                        <div className="page-agenda__calendar ref-panel">
                          <div className="page-agenda__weekdays">
                            {WEEKDAYS.map((w) => (
                              <div key={w} className="page-agenda__weekday">
                                {w}
                              </div>
                            ))}
                          </div>
                          <div className="page-agenda__month-grid">
                            {gridCells.map((cell) => {
                              const dayEvents = eventsByDate[cell.key] || []
                              const isToday = cell.key === todayKey
                              const isSelected = cell.key === selectedKey
                              return (
                                <div
                                  key={cell.key}
                                  className={`page-agenda__cell ${cell.inMonth ? '' : 'page-agenda__cell--muted'} ${
                                    isToday ? 'page-agenda__cell--today' : ''
                                  } ${isSelected ? 'page-agenda__cell--selected' : ''}`}
                                  onClick={() => setSelectedKey(cell.key)}
                                  onKeyDown={(e) => e.key === 'Enter' && setSelectedKey(cell.key)}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="page-agenda__cell-head">
                                    <span className="page-agenda__cell-num">{cell.date.getDate()}</span>
                                    <button
                                      type="button"
                                      className="page-agenda__cell-add"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const d = cloneDate(cell.date)
                                        d.setHours(9, 0, 0, 0)
                                        openNew(d.toISOString())
                                      }}
                                      aria-label={`Novo evento em ${cell.key}`}
                                    >
                                      +
                                    </button>
                                  </div>
                                  <div
                                    className="page-agenda__cell-body"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {dayEvents.slice(0, 3).map((ev) => (
                                      <button
                                        key={ev.id}
                                        type="button"
                                        className="page-agenda__chip"
                                        style={{ borderLeftColor: ev.color || '#94a3b8' }}
                                        onClick={() => openEdit(ev)}
                                      >
                                        <span className="page-agenda__chip-title">{ev.title}</span>
                                      </button>
                                    ))}
                                    {dayEvents.length > 3 ? (
                                      <span className="page-agenda__more">+{dayEvents.length - 3}</span>
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {view === AGENDA_VIEW_MODES.WEEK && (
                        <div className="page-agenda__week ref-panel">
                          <div className="page-agenda__week-grid">
                            {weekDays.map((d, i) => {
                              const k = toDateKey(d)
                              const list = eventsByDate[k] || []
                              const isToday = k === todayKey
                              return (
                                <div key={k} className={`page-agenda__week-col ${isToday ? 'page-agenda__week-col--today' : ''}`}>
                                  <div className="page-agenda__week-col-head">
                                    <span>{WEEKDAYS[i] ?? ''}</span>
                                    <strong>{d.getDate()}</strong>
                                    <button
                                      type="button"
                                      className="page-agenda__cell-add"
                                      onClick={() => {
                                        const x = cloneDate(d)
                                        x.setHours(9, 0, 0, 0)
                                        openNew(x.toISOString())
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                  <div className="page-agenda__week-events">
                                    {list.map((ev) => (
                                      <button
                                        key={ev.id}
                                        type="button"
                                        className="page-agenda__chip page-agenda__chip--block"
                                        style={{ borderLeftColor: ev.color || '#94a3b8' }}
                                        onClick={() => openEdit(ev)}
                                      >
                                        {ev.title}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {view === AGENDA_VIEW_MODES.DAY && (
                        <div className="page-agenda__day ref-panel">
                          <h3 className="page-agenda__day-title">{dayLabel}</h3>
                          <ul className="page-agenda__day-list">
                            {(eventsByDate[toDateKey(cursorDate)] || []).slice().sort(sortByStart).map((ev) => (
                              <li key={ev.id} className="page-agenda__day-item">
                                <button type="button" className="page-agenda__day-link" onClick={() => openEdit(ev)}>
                                  <span className="page-agenda__day-time">
                                    {ev.allDay
                                      ? 'Dia inteiro'
                                      : new Date(ev.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="page-agenda__day-title-text">{ev.title}</span>
                                  <span className="page-agenda__day-type">{AGENDA_TYPE_LABELS[ev.type] || ev.type}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            className="ref-empty-cta page-agenda__day-new"
                            onClick={() => {
                              const x = cloneDate(cursorDate)
                              x.setHours(9, 0, 0, 0)
                              openNew(x.toISOString())
                            }}
                          >
                            Novo evento neste dia
                          </button>
                        </div>
                      )}

                      {view === AGENDA_VIEW_MODES.LIST && (
                        <div className="page-agenda__list-wrap ref-panel">
                          <div className="page-agenda__list page-agenda__list--desktop">
                            <div className="page-agenda__list-head">
                              <span>Data</span>
                              <span>Hora</span>
                              <span>Título</span>
                              <span>Tipo</span>
                              <span>Status</span>
                              <span>Valor</span>
                              <span>Ações</span>
                            </div>
                            {listRows.map((ev) => (
                              <div key={ev.id} className="page-agenda__list-row">
                                <span>{new Date(ev.startAt).toLocaleDateString('pt-BR')}</span>
                                <span>
                                  {ev.allDay
                                    ? '—'
                                    : new Date(ev.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="page-agenda__list-title">{ev.title}</span>
                                <span>{AGENDA_TYPE_LABELS[ev.type] || ev.type}</span>
                                <span>{AGENDA_STATUS_LABELS[ev.status] || ev.status}</span>
                                <span className={privacyMode ? 'privacy-blur' : ''}>
                                  {ev.amount != null && ev.amount !== '' ? formatCurrencyBRL(ev.amount) : '—'}
                                </span>
                                <span className="page-agenda__list-actions">
                                  <button type="button" className="btn-secondary" onClick={() => openEdit(ev)}>
                                    Abrir
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="page-agenda__list page-agenda__list--mobile">
                            {listRows.map((ev) => (
                              <button key={ev.id} type="button" className="page-agenda__card-mobile" onClick={() => openEdit(ev)}>
                                <div>
                                  <strong>{ev.title}</strong>
                                  <p>
                                    {new Date(ev.startAt).toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                                <span className="page-agenda__card-meta">{AGENDA_STATUS_LABELS[ev.status] || ev.status}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <aside className="page-agenda__side ref-panel" aria-label="Painel da agenda">
                  <h3 className="ref-panel__title">Próximos eventos</h3>
                  <ul className="page-agenda__upcoming">
                    {upcoming.length === 0 ? (
                      <li className="page-agenda__empty">Nenhum evento nos filtros atuais.</li>
                    ) : (
                      upcoming.map((ev) => (
                        <li key={ev.id}>
                          <button type="button" className="page-agenda__upcoming-btn" onClick={() => openEdit(ev)}>
                            <span className="page-agenda__upcoming-date">
                              {new Date(ev.startAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                            <span className="page-agenda__upcoming-title">{ev.title}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>

                  <h3 className="ref-panel__title page-agenda__side-title">Filtros</h3>
                  <div className="page-agenda__filters">
                    <label>
                      Tipo
                      <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                        <option value="">Todos</option>
                        {Object.entries(AGENDA_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                        <option value="">Todos</option>
                        {Object.entries(AGENDA_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Prioridade
                      <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)}>
                        <option value="">Todas</option>
                        {Object.entries(AGENDA_PRIORITY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      De
                      <input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} />
                    </label>
                    <label>
                      Até
                      <input type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} />
                    </label>
                    <button type="button" className="btn-secondary page-agenda__clear-filters" onClick={limparFiltros}>
                      Limpar filtros
                    </button>
                  </div>

                  <h3 className="ref-panel__title page-agenda__side-title">Legenda</h3>
                  <ul className="page-agenda__legend">
                    {Object.entries(AGENDA_TYPE_LABELS).map(([value, label]) => (
                      <li key={value}>
                        <span className={`page-agenda__dot page-agenda__dot--${value}`} aria-hidden />
                        {label}
                      </li>
                    ))}
                  </ul>

                  <h3 className="ref-panel__title page-agenda__side-title">
                    Dia {new Date(selectedKey + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </h3>
                  <p className="page-agenda__side-count">{selectedDayEvents.length} evento(s)</p>
                  <div className="page-agenda__quick">
                    <button type="button" className="ref-empty-cta" onClick={() => openNew()}>
                      Novo evento
                    </button>
                    {selectedDayEvents.map((ev) => (
                      <div key={ev.id} className="page-agenda__quick-row">
                        <span>{ev.title}</span>
                        <div className="page-agenda__quick-actions">
                          {ev.type === AGENDA_EVENT_TYPES.TAREFA || ev.type === AGENDA_EVENT_TYPES.LEMBRETE ? (
                            <button type="button" className="btn-secondary" onClick={() => quickStatus(ev.id, 'concluido')}>
                              Concluir
                            </button>
                          ) : null}
                          {ev.type === AGENDA_EVENT_TYPES.CONTA_PAGAR ? (
                            <button type="button" className="btn-secondary" onClick={() => quickStatus(ev.id, 'pago')}>
                              Pago
                            </button>
                          ) : null}
                          {ev.type === AGENDA_EVENT_TYPES.CONTA_RECEBER ? (
                            <button type="button" className="btn-secondary" onClick={() => quickStatus(ev.id, 'recebido')}>
                              Recebido
                            </button>
                          ) : null}
                          <button type="button" className="btn-secondary" onClick={() => openEdit(ev)}>
                            Editar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>

      <AgendaEventModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingEvent(null)
        }}
        event={editingEvent}
        onSubmit={handleSubmit}
        onDelete={editingEvent?.id ? handleDelete : undefined}
        onDuplicate={editingEvent?.id ? handleDuplicate : undefined}
      />
    </>
  )
}

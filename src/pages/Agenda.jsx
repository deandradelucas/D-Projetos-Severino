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

function formatDate(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(iso))
}

function formatTime(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: AGENDA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
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

  const usuarioId = usuario?.id ? String(usuario.id).trim() : ''

  const loadAgenda = useCallback(async () => {
    if (!usuarioId) return
    setLoading(true)
    setError('')
    try {
      const todayKey = saoPauloDateKey(new Date())
      const from = new Date(`${todayKey}T00:00:00${SAO_PAULO_OFFSET}`)
      const to = new Date(from)
      to.setDate(to.getDate() + 45)
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
  }, [usuarioId])

  useEffect(() => {
    void loadAgenda()
  }, [loadAgenda])

  const stats = useMemo(() => {
    const upcoming = eventos.filter((ev) => ev.status !== 'CANCELADO' && ev.status !== 'CONCLUIDO')
    return {
      hoje: upcoming.filter((ev) => isToday(ev.inicio)).length,
      confirmados: upcoming.filter((ev) => ev.status === 'CONFIRMADO').length,
      proximos: upcoming.length,
      whatsapp: upcoming.filter((ev) => ev.whatsapp_notificar).length,
    }
  }, [eventos])

  const nextEvento = useMemo(
    () => eventos.find((ev) => ev.status !== 'CANCELADO' && ev.status !== 'CONCLUIDO') || null,
    [eventos]
  )

  const grouped = useMemo(() => {
    const map = new Map()
    for (const ev of eventos) {
      const key = saoPauloDateKey(ev.inicio)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(ev)
    }
    return [...map.entries()].map(([key, rows]) => ({ key, rows }))
  }, [eventos])

  function openNew() {
    const d = new Date()
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
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
      if (!res.ok) throw new Error(data.message || 'Falha ao salvar compromisso.')
      showToast(editing ? 'Compromisso atualizado.' : 'Compromisso criado.', 'success')
      setModalOpen(false)
      await loadAgenda()
    } catch (err) {
      showToast(err.message || 'Falha ao salvar compromisso.', 'error')
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
                  <div className="dashboard-hub__hero-text">
                    <span className="dashboard-hub__eyebrow">Agenda</span>
                    <h1 className="dashboard-hub__title">Seu tempo no controle</h1>
                    <div className="dashboard-hub__balance-line">
                      <span>Uma linha do tempo inteligente para compromissos, lembretes e comandos por voz.</span>
                    </div>
                  </div>
                  <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Ações da agenda">
                    <button type="button" className="dashboard-hub__btn dashboard-hub__btn--primary" onClick={openNew}>
                      + Novo compromisso
                    </button>
                  </div>
                </div>
                <div className="agenda-hero__brief" aria-label="Próximo compromisso">
                  <div className="agenda-hero__brief-main">
                    <span className="agenda-section-eyebrow">Próximo compromisso</span>
                    {nextEvento ? (
                      <div className="agenda-hero__next">
                        <strong>{nextEvento.titulo}</strong>
                        <span>{formatDate(nextEvento.inicio)} às {formatTime(nextEvento.inicio)}</span>
                      </div>
                    ) : (
                      <div className="agenda-hero__next">
                        <strong>Sem pendências imediatas</strong>
                        <span>Use o botão acima ou envie um áudio pelo WhatsApp.</span>
                      </div>
                    )}
                  </div>
                  <div className="agenda-hero__mini-stats" aria-label="Resumo rápido">
                    <div>
                      <strong>{stats.hoje}</strong>
                      <span>hoje</span>
                    </div>
                    <div>
                      <strong>{stats.whatsapp}</strong>
                      <span>avisos</span>
                    </div>
                  </div>
                  <span className="agenda-hero__chip">America/São_Paulo</span>
                </div>
              </section>

              <section className="agenda-kpis" aria-label="Resumo da agenda">
                <article className="agenda-kpi agenda-kpi--hero">
                  <div className="agenda-kpi__top">
                    <span>Hoje</span>
                    <i aria-hidden="true">H</i>
                  </div>
                  <strong>{stats.hoje}</strong>
                  <p>compromissos ativos</p>
                </article>
                <article className="agenda-kpi">
                  <div className="agenda-kpi__top">
                    <span>Próximos</span>
                    <i aria-hidden="true">P</i>
                  </div>
                  <strong>{stats.proximos}</strong>
                  <p>nos próximos 45 dias</p>
                </article>
                <article className="agenda-kpi">
                  <div className="agenda-kpi__top">
                    <span>Confirmados</span>
                    <i aria-hidden="true">C</i>
                  </div>
                  <strong>{stats.confirmados}</strong>
                  <p>com presença marcada</p>
                </article>
                <article className="agenda-kpi">
                  <div className="agenda-kpi__top">
                    <span>WhatsApp</span>
                    <i aria-hidden="true">W</i>
                  </div>
                  <strong>{stats.whatsapp}</strong>
                  <p>com lembrete ativo</p>
                </article>
              </section>

              <section className="agenda-list-panel" aria-label="Lista de compromissos">
                <div className="agenda-list-panel__header">
                  <div>
                    <span className="agenda-section-eyebrow">Linha do tempo</span>
                    <h2>Próximos compromissos</h2>
                  </div>
                  <button type="button" className="agenda-secondary-btn" onClick={openNew}>Adicionar</button>
                </div>

                {loading ? (
                  <div className="agenda-empty">Carregando agenda...</div>
                ) : error ? (
                  <div className="agenda-empty agenda-empty--error">{error}</div>
                ) : grouped.length === 0 ? (
                  <div className="agenda-empty">
                    <strong>Sua agenda está livre.</strong>
                    <span>Crie um compromisso no app ou envie “marcar reunião amanhã às 15h” pelo WhatsApp.</span>
                  </div>
                ) : (
                  <div className="agenda-days">
                    {grouped.map((group) => (
                      <div className="agenda-day" key={group.key}>
                        <div className="agenda-day__label">{formatDate(group.rows[0].inicio)}</div>
                        <div className="agenda-day__cards">
                          {group.rows.map((evento) => (
                            <article className={`agenda-event agenda-event--${eventTone(evento.status)}`} key={evento.id}>
                              <span className="agenda-event__halo" aria-hidden="true" />
                              <div className="agenda-event__time">
                                <strong>{formatTime(evento.inicio)}</strong>
                                <span>{evento.lembrar_minutos_antes} min</span>
                              </div>
                              <div className="agenda-event__body">
                                <div className="agenda-event__topline">
                                  <h3>{evento.titulo}</h3>
                                  <span className={`agenda-status agenda-status--${eventTone(evento.status)}`}>
                                    {STATUS_LABEL[evento.status] || evento.status}
                                  </span>
                                </div>
                                {evento.local ? <p className="agenda-event__local">{evento.local}</p> : null}
                                {evento.descricao ? <p className="agenda-event__desc">{evento.descricao}</p> : null}
                                <div className="agenda-event__meta">
                                  <span>{evento.whatsapp_notificar ? 'WhatsApp ativo' : 'Sem WhatsApp'}</span>
                                  <span>Código {evento.id.slice(0, 8)}</span>
                                </div>
                                <div className="agenda-event__actions">
                                  <button type="button" className="agenda-action agenda-action--ghost" onClick={() => openEdit(evento)}>Editar</button>
                                  <button type="button" className="agenda-action agenda-action--primary" onClick={() => setStatus(evento, 'CONFIRMADO')}>Confirmar</button>
                                  <button type="button" className="agenda-action agenda-action--ghost" onClick={() => setStatus(evento, 'CONCLUIDO')}>Concluir</button>
                                  <button type="button" className="agenda-action agenda-action--danger" onClick={() => setStatus(evento, 'CANCELADO')}>Cancelar</button>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </RefDashboardScroll>
          </div>
        </main>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editing ? 'Editar compromisso' : 'Novo compromisso'}>
          <form className="agenda-modal" onSubmit={saveEvent}>
            <div className="agenda-modal__header">
              <div>
                <span className="agenda-section-eyebrow">{editing ? 'Editar agenda' : 'Novo na agenda'}</span>
                <h2>{editing ? 'Atualizar compromisso' : 'Criar compromisso'}</h2>
              </div>
              <button type="button" className="agenda-modal__close" onClick={() => setModalOpen(false)} aria-label="Fechar">×</button>
            </div>

            <label className="agenda-field">
              <span>Título</span>
              <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} required maxLength={160} placeholder="Ex.: reunião com cliente" />
            </label>
            <label className="agenda-field">
              <span>Data e hora (São Paulo)</span>
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
                <span>Lembrete</span>
                <select value={form.lembrar_minutos_antes} onChange={(e) => setForm((f) => ({ ...f, lembrar_minutos_antes: e.target.value }))}>
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
                {saving ? 'Salvando...' : 'Salvar compromisso'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

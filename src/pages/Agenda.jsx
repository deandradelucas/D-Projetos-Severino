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

function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localToIso(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(iso))
}

function formatTime(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function isToday(iso) {
  const d = new Date(iso)
  const now = new Date()
  return d.toDateString() === now.toDateString()
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
      const from = new Date()
      from.setHours(0, 0, 0, 0)
      const to = new Date()
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

  const grouped = useMemo(() => {
    const map = new Map()
    for (const ev of eventos) {
      const key = new Date(ev.inicio).toISOString().slice(0, 10)
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
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto(true)} />
                  <div className="dashboard-hub__hero-text">
                    <span className="dashboard-hub__eyebrow">Agenda</span>
                    <h1 className="dashboard-hub__title">Seu dia, organizado</h1>
                    <div className="dashboard-hub__balance-line">
                      <span>Compromissos, lembretes e ações rápidas em um só lugar.</span>
                    </div>
                  </div>
                  <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Ações da agenda">
                    <button type="button" className="dashboard-hub__btn dashboard-hub__btn--primary" onClick={openNew}>
                      + Novo compromisso
                    </button>
                  </div>
                </div>
              </section>

              <section className="agenda-kpis" aria-label="Resumo da agenda">
                <article className="agenda-kpi agenda-kpi--hero">
                  <span>Hoje</span>
                  <strong>{stats.hoje}</strong>
                  <p>compromissos ativos</p>
                </article>
                <article className="agenda-kpi">
                  <span>Próximos</span>
                  <strong>{stats.proximos}</strong>
                  <p>nos próximos 45 dias</p>
                </article>
                <article className="agenda-kpi">
                  <span>Confirmados</span>
                  <strong>{stats.confirmados}</strong>
                  <p>com presença marcada</p>
                </article>
                <article className="agenda-kpi">
                  <span>WhatsApp</span>
                  <strong>{stats.whatsapp}</strong>
                  <p>com lembrete ativo</p>
                </article>
              </section>

              <section className="agenda-list-panel" aria-label="Lista de compromissos">
                <div className="agenda-list-panel__header">
                  <div>
                    <span className="agenda-whatsapp-card__eyebrow">Linha do tempo</span>
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
                                  <button type="button" onClick={() => openEdit(evento)}>Editar</button>
                                  <button type="button" onClick={() => setStatus(evento, 'CONFIRMADO')}>Confirmar</button>
                                  <button type="button" onClick={() => setStatus(evento, 'CONCLUIDO')}>Concluir</button>
                                  <button type="button" onClick={() => setStatus(evento, 'CANCELADO')}>Cancelar</button>
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
                <span className="agenda-whatsapp-card__eyebrow">{editing ? 'Editar agenda' : 'Novo na agenda'}</span>
                <h2>{editing ? 'Atualizar compromisso' : 'Criar compromisso'}</h2>
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

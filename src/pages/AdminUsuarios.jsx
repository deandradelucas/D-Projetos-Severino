import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import UserAdminStatusBadge from '../components/admin/UserAdminStatusBadge'
import AdminUsuarioCard from '../components/admin/AdminUsuarioCard'
import AdminUsuariosKpis from '../components/admin/AdminUsuariosKpis'
import AdminUsuariosFilters from '../components/admin/AdminUsuariosFilters'
import ConfirmDialog from '../components/ConfirmDialog'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { formatPhoneBRDisplay } from '../lib/formatPhoneBR'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import {
  buildUsuariosAdminQuery,
  formatDateTimePtBr,
  rowsToUsersAdminCsv,
} from '../lib/usersAdmin'
import { isSuperAdminEmail, isSuperAdminSession } from '../lib/superAdmin'
import {
  ROLE_OPTIONS,
  normalizeRoleKey,
  roleDisplayLabel,
  downloadTextFile,
} from '../lib/adminUsuariosUtils.js'
import './dashboard.css'

const PAGE_SIZE = 12

const ROLE_OPTIONS_NON_SUPER = ROLE_OPTIONS.filter((o) => o.value !== 'ADMIN')

export default function AdminUsuarios() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [listaUsuarios, setListaUsuarios] = useState([])
  const [totalLista, setTotalLista] = useState(0)
  const [stats, setStats] = useState(null)
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [editingUserId, setEditingUserId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [userFilter, setUserFilter] = useState('')
  const [userFilterDebounced, setUserFilterDebounced] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterConta, setFilterConta] = useState('')
  const [filterSort, setFilterSort] = useState('email_asc')
  const [filterAssinatura, setFilterAssinatura] = useState('')
  const [filterLogin, setFilterLogin] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')
  const [filterAccessFrom, setFilterAccessFrom] = useState('')
  const [filterAccessTo, setFilterAccessTo] = useState('')
  const [filterPayFrom, setFilterPayFrom] = useState('')
  const [filterPayTo, setFilterPayTo] = useState('')
  const [filterTrialEndsFrom, setFilterTrialEndsFrom] = useState('')
  const [filterTrialEndsTo, setFilterTrialEndsTo] = useState('')
  const [detailUser, setDetailUser] = useState(null)
  const [page, setPage] = useState(1)
  const [userActionMessage, setUserActionMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [sessionBanner, setSessionBanner] = useState('')
  const [exportingCsv, setExportingCsv] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null)
  /** Filtros avançados (busca, selects, períodos) começam recolhidos para dar foco à tabela. */
  const [usuariosFiltersOpen, setUsuariosFiltersOpen] = useState(false)

  const principalPodeDarAdmin = isSuperAdminSession()
  const roleOptionsEdit = principalPodeDarAdmin ? ROLE_OPTIONS : ROLE_OPTIONS_NON_SUPER

  useEffect(() => {
    const t = window.setTimeout(() => setUserFilterDebounced(userFilter.trim()), 400)
    return () => window.clearTimeout(t)
  }, [userFilter])

  useEffect(() => {
    setPage(1)
  }, [
    userFilterDebounced,
    filterRole,
    filterConta,
    filterSort,
    filterAssinatura,
    filterLogin,
    filterCreatedFrom,
    filterCreatedTo,
    filterAccessFrom,
    filterAccessTo,
    filterPayFrom,
    filterPayTo,
    filterTrialEndsFrom,
    filterTrialEndsTo,
  ])

  const refreshUsuarios = useCallback(async () => {
    setLoadingUsuarios(true)
    setLoadError('')
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) {
        setLoadError('Faça login para carregar os usuários.')
        return
      }
      JSON.parse(userSaved)
      const qs = buildUsuariosAdminQuery({
        page,
        pageSize: PAGE_SIZE,
        q: userFilterDebounced,
        role: filterRole,
        conta: filterConta,
        sort: filterSort,
        assinatura: filterAssinatura,
        login: filterLogin,
        createdFrom: filterCreatedFrom,
        createdTo: filterCreatedTo,
        accessFrom: filterAccessFrom,
        accessTo: filterAccessTo,
        payFrom: filterPayFrom,
        payTo: filterPayTo,
        trialEndsFrom: filterTrialEndsFrom,
        trialEndsTo: filterTrialEndsTo,
      })
      const res = await apiFetch(apiUrl(`/api/admin/usuarios?${qs}`), {})
      const data = await res.json().catch(() => ({}))
      if (res.ok && data && Array.isArray(data.items)) {
        setListaUsuarios(data.items)
        setTotalLista(typeof data.total === 'number' ? data.total : data.items.length)
        setStats(data.stats || null)
      } else {
        setListaUsuarios([])
        setTotalLista(0)
        setStats(null)
        setLoadError(data.message || `Erro ao buscar usuários (${res.status}).`)
      }
    } catch (e) {
      setListaUsuarios([])
      setLoadError(e.message || 'Falha de rede ao carregar usuários.')
    } finally {
      setLoadingUsuarios(false)
    }
  }, [
    page,
    userFilterDebounced,
    filterRole,
    filterConta,
    filterSort,
    filterAssinatura,
    filterLogin,
    filterCreatedFrom,
    filterCreatedTo,
    filterAccessFrom,
    filterAccessTo,
    filterPayFrom,
    filterPayTo,
    filterTrialEndsFrom,
    filterTrialEndsTo,
  ])

  useEffect(() => {
    void refreshUsuarios()
  }, [refreshUsuarios])

  const totalPages = Math.max(1, Math.ceil(totalLista / PAGE_SIZE))

  // Removemos o useEffect que causava loop infinito com setPage e totalPages
  const pageSafe = Math.min(page, totalPages)
  const pageRows = listaUsuarios
  const start = (pageSafe - 1) * PAGE_SIZE

  const clearFilters = () => {
    setUserFilter('')
    setFilterRole('')
    setFilterConta('')
    setFilterSort('email_asc')
    setFilterAssinatura('')
    setFilterLogin('')
    setFilterCreatedFrom('')
    setFilterCreatedTo('')
    setFilterAccessFrom('')
    setFilterAccessTo('')
    setFilterPayFrom('')
    setFilterPayTo('')
    setFilterTrialEndsFrom('')
    setFilterTrialEndsTo('')
  }

  const exportarCsv = async () => {
    setExportingCsv(true)
    setUserActionMessage('')
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      JSON.parse(userSaved)
      const qs = buildUsuariosAdminQuery({
        page: 1,
        pageSize: 5000,
        q: userFilterDebounced,
        role: filterRole,
        conta: filterConta,
        sort: filterSort,
        assinatura: filterAssinatura,
        login: filterLogin,
        createdFrom: filterCreatedFrom,
        createdTo: filterCreatedTo,
        accessFrom: filterAccessFrom,
        accessTo: filterAccessTo,
        payFrom: filterPayFrom,
        payTo: filterPayTo,
        trialEndsFrom: filterTrialEndsFrom,
        trialEndsTo: filterTrialEndsTo,
      })
      const res = await apiFetch(apiUrl(`/api/admin/usuarios?${qs}`), {})
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Falha ao exportar.')
      const items = Array.isArray(data.items) ? data.items : []
      const csv = rowsToUsersAdminCsv(items)
      const bom = '﻿'
      downloadTextFile(`horizonte-usuarios-${new Date().toISOString().slice(0, 10)}.csv`, bom + csv)
      setUserActionMessage(`CSV com ${items.length} linha(s) gerado.`)
    } catch (e) {
      setUserActionMessage(e.message || 'Erro ao exportar.')
    } finally {
      setExportingCsv(false)
    }
  }

  const handleEditUser = (user) => {
    setEditingUserId(user.id)
    setEditForm({
      nome: user.nome || '',
      email: user.email || '',
      telefone: user.telefone || '',
      role: normalizeRoleKey(user.role),
      is_active: user.is_active !== false,
      isento_pagamento: user.isento_pagamento === true,
    })
    setUserActionMessage('')
  }

  const handleCancelEdit = () => {
    setEditingUserId(null)
    setEditForm({})
  }

  const handleChangeField = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  const executeSaveUser = async () => {
    if (!editingUserId) return
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      JSON.parse(userSaved)

      const antes = listaUsuarios.find((row) => row.id === editingUserId)

      const res = await apiFetch(apiUrl(`/api/admin/usuarios/${editingUserId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Falha ao salvar usuário.')

      if (antes && normalizeRoleKey(antes.role) !== normalizeRoleKey(data.role)) {
        setSessionBanner(
          'Papel alterado: peça para o usuário abrir Ajustes ou entrar de novo para atualizar o menu.'
        )
      } else {
        setSessionBanner('')
      }

      setUserActionMessage('Usuário atualizado com sucesso.')
      setEditingUserId(null)
      setEditForm({})
      void refreshUsuarios()
    } catch (e) {
      setUserActionMessage(e.message)
    }
  }

  const handleSaveUser = () => {
    if (!editingUserId) return
    const antes = listaUsuarios.find((row) => row.id === editingUserId)
    if (antes) {
      if (normalizeRoleKey(antes.role) === 'ADMIN' && normalizeRoleKey(editForm.role) !== 'ADMIN') {
        setConfirmDialog({ kind: 'save-demote' })
        return
      }
      if (antes.is_active !== false && editForm.is_active === false) {
        setConfirmDialog({ kind: 'save-deactivate' })
        return
      }
    }
    void executeSaveUser()
  }

  const executeDeleteUser = async (user) => {
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      JSON.parse(userSaved)

      const res = await apiFetch(apiUrl(`/api/admin/usuarios/${user.id}`), {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Falha ao excluir usuário.')

      setListaUsuarios((prev) => prev.filter((row) => row.id !== user.id))
      setUserActionMessage('Usuário excluído.')
      if (editingUserId === user.id) {
        setEditingUserId(null)
        setEditForm({})
      }
      void refreshUsuarios()
    } catch (e) {
      setUserActionMessage(e.message)
    }
  }

  const handleDeleteUser = (user) => {
    setConfirmDialog({ kind: 'delete-user', user })
  }

  const handleResetPasswordWhatsapp = async (user) => {
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      JSON.parse(userSaved)
      const res = await apiFetch(apiUrl(`/api/admin/usuarios/${user.id}/solicitar-otp-senha-whatsapp`), {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Falha ao solicitar código pelo WhatsApp.')
      setUserActionMessage(data.message || 'Código enviado.')
    } catch (e) {
      setUserActionMessage(e.message)
    }
  }

  const executeDetailToggleActive = async (nextActive) => {
    if (!detailUser || isSuperAdminEmail(detailUser.email)) return
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      JSON.parse(userSaved)
      const res = await apiFetch(apiUrl(`/api/admin/usuarios/${detailUser.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Falha ao atualizar conta.')
      setDetailUser({ ...detailUser, is_active: nextActive })
      setUserActionMessage(nextActive ? 'Conta reativada.' : 'Conta desativada.')
      void refreshUsuarios()
    } catch (e) {
      setUserActionMessage(e.message || 'Erro ao atualizar.')
    }
  }

  const handleDetailToggleActive = () => {
    if (!detailUser || isSuperAdminEmail(detailUser.email)) return
    const currentlyActive = detailUser.is_active !== false
    const nextActive = !currentlyActive
    if (currentlyActive && !nextActive) {
      setConfirmDialog({ kind: 'detail-deactivate' })
      return
    }
    void executeDetailToggleActive(nextActive)
  }

  const getUserConnectionBadge = (user) => {
    const baseStyle = {
      padding: '4px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '600',
    }
    if (!user.last_login_at) {
      return null
    }
    const last = new Date(user.last_login_at)
    const diffMin = (Date.now() - last.getTime()) / 60000
    if (diffMin <= 5) {
      return <span style={{ ...baseStyle, backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Online recente</span>
    }
    if (diffMin <= 1440) {
      return <span style={{ ...baseStyle, backgroundColor: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>Ativo hoje</span>
    }
    return <span style={{ ...baseStyle, backgroundColor: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>Offline</span>
  }

  return (
    <div className="dashboard-container dashboard-page page-admin page-admin-usuarios ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
            <section className="dashboard-hub__hero" aria-label="Logs de usuários">
              <div className="dashboard-hub__hero-row">
                <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                <div className="dashboard-hub__hero-text">
                  <h1 className="dashboard-hub__title">Logs de usuários</h1>
                </div>
                <div className="dashboard-hub__hero-actions page-admin-hero-actions" role="toolbar" aria-label="Atalhos da administração">
                  <Link to="/cadastro" className="dashboard-hub__btn dashboard-hub__btn--primary">
                    Nova conta
                  </Link>
                  <Link to="/admin/pagamentos" className="dashboard-hub__btn dashboard-hub__btn--secondary">
                    Logs de pagamentos
                  </Link>
                  <Link to="/admin/auditoria" className="dashboard-hub__btn dashboard-hub__btn--secondary">
                    Auditoria
                  </Link>
                </div>
              </div>
            </section>

            <section
              className="ref-kpi-row ref-dashboard-kpi-strip dashboard-hub__kpis page-admin-usuarios-kpis"
              aria-label="Resumo de cadastros e assinaturas"
              aria-busy={loadingUsuarios}
            >
              <AdminUsuariosKpis stats={stats} loading={loadingUsuarios} />
            </section>

            <article
              className="ref-panel page-admin-ref-panel page-admin-ref-panel--table page-admin-usuarios-panel"
              aria-labelledby="admin-users-heading"
            >
              <div className="ref-panel__head page-admin-usuarios-panel-head">
                <div className="page-admin-usuarios-head-stack">
                  <div className="page-admin-usuarios-head-top">
                    <h2 id="admin-users-heading" className="ref-panel__title page-admin-usuarios-panel-title">
                      Cadastros e acessos
                    </h2>
                    <div className="page-admin-usuarios-head-actions page-admin-usuarios-head-actions--always">
                      <button
                        type="button"
                        className="btn-secondary page-admin-toolbar-btn page-admin-usuarios-filters-toggle"
                        id="admin-users-filters-disclosure"
                        aria-expanded={usuariosFiltersOpen}
                        aria-controls="admin-users-filters-region"
                        onClick={() => setUsuariosFiltersOpen((v) => !v)}
                      >
                        {usuariosFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
                      </button>
                      <button type="button" className="btn-secondary page-admin-toolbar-btn" disabled={loadingUsuarios} onClick={() => void refreshUsuarios()}>
                        {loadingUsuarios ? 'Atualizando…' : 'Atualizar lista'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary page-admin-toolbar-btn"
                        disabled={exportingCsv || loadingUsuarios}
                        onClick={() => void exportarCsv()}
                      >
                        {exportingCsv ? 'Exportando…' : 'Exportar CSV'}
                      </button>
                    </div>
                  </div>
                  {usuariosFiltersOpen ? (
                    <p id="admin-users-filters-intro" className="ref-panel__subtitle page-admin-usuarios-intro">
                      Filtre por cadastro, acesso, assinatura e receita. Apenas o administrador principal pode promover alguém a Admin. Edite linhas, redefina senha ou
                      exclua contas (exceto a administradora principal).
                    </p>
                  ) : null}
                </div>
              </div>

              {loadError ? <div className="page-admin-alert">{loadError}</div> : null}
              {sessionBanner ? (
                <div className="page-admin-session-banner" role="status">
                  {sessionBanner}
                  <button type="button" className="page-admin-session-banner-dismiss" onClick={() => setSessionBanner('')}>
                    Fechar
                  </button>
                </div>
              ) : null}
              {userActionMessage ? <div className="page-admin-toast-msg">{userActionMessage}</div> : null}

              {usuariosFiltersOpen ? (
                <AdminUsuariosFilters
                  userFilter={userFilter}
                  setUserFilter={setUserFilter}
                  filterRole={filterRole}
                  setFilterRole={setFilterRole}
                  filterConta={filterConta}
                  setFilterConta={setFilterConta}
                  filterSort={filterSort}
                  setFilterSort={setFilterSort}
                  filterAssinatura={filterAssinatura}
                  setFilterAssinatura={setFilterAssinatura}
                  filterLogin={filterLogin}
                  setFilterLogin={setFilterLogin}
                  filterCreatedFrom={filterCreatedFrom}
                  setFilterCreatedFrom={setFilterCreatedFrom}
                  filterCreatedTo={filterCreatedTo}
                  setFilterCreatedTo={setFilterCreatedTo}
                  filterAccessFrom={filterAccessFrom}
                  setFilterAccessFrom={setFilterAccessFrom}
                  filterAccessTo={filterAccessTo}
                  setFilterAccessTo={setFilterAccessTo}
                  filterPayFrom={filterPayFrom}
                  setFilterPayFrom={setFilterPayFrom}
                  filterPayTo={filterPayTo}
                  setFilterPayTo={setFilterPayTo}
                  filterTrialEndsFrom={filterTrialEndsFrom}
                  setFilterTrialEndsFrom={setFilterTrialEndsFrom}
                  filterTrialEndsTo={filterTrialEndsTo}
                  setFilterTrialEndsTo={setFilterTrialEndsTo}
                  onClearFilters={clearFilters}
                />
              ) : null}

              <p className="page-admin-usuarios-meta" aria-live="polite">
                {loadingUsuarios
                  ? 'Carregando…'
                  : (() => {
                      const base = `${totalLista} ${totalLista === 1 ? 'resultado' : 'resultados'} nesta página`
                      if (!stats) return base
                      return `${base} · ${stats.total} cadastro(s) no sistema`
                    })()}
              </p>

              <div className="page-admin-usuarios-cards-wrap">
                {loadingUsuarios ? (
                  <ul className="page-admin-usuarios-cards" aria-busy="true" aria-label="Carregando usuários">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <li key={`usuarios-skel-${i}`}>
                        <div className="page-admin-usuario-card page-admin-usuario-card--skeleton">
                          <div className="page-admin-usuario-card__sk-head">
                            <span className="skeleton skeleton-pulse page-admin-usuario-card__sk-bar page-admin-usuario-card__sk-bar--lg" />
                            <span className="skeleton skeleton-pulse page-admin-usuario-card__sk-bar page-admin-usuario-card__sk-bar--md" />
                          </div>
                          <div className="page-admin-usuario-card__sk-grid">
                            {Array.from({ length: 4 }).map((__, j) => (
                              <div key={j} className="page-admin-usuario-card__sk-field">
                                <span className="skeleton skeleton-pulse page-admin-usuario-card__sk-bar page-admin-usuario-card__sk-bar--xs" />
                                <span className="skeleton skeleton-pulse page-admin-usuario-card__sk-bar" />
                              </div>
                            ))}
                          </div>
                          <div className="page-admin-usuario-card__sk-actions">
                            <span className="skeleton skeleton-pulse page-admin-usuario-card__sk-pill" />
                            <span className="skeleton skeleton-pulse page-admin-usuario-card__sk-pill" />
                            <span className="skeleton skeleton-pulse page-admin-usuario-card__sk-pill" />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : !loadingUsuarios && totalLista === 0 && stats && stats.total === 0 ? (
                  <div className="page-admin-empty-block">
                    <p className="page-admin-empty">Nenhum usuário cadastrado ainda.</p>
                    <p className="page-admin-empty-hint">Use &quot;Nova conta&quot; ou peça para alguém se cadastrar.</p>
                  </div>
                ) : !loadingUsuarios && totalLista === 0 ? (
                  <div className="page-admin-empty-block">
                    <p className="page-admin-empty">Nenhum resultado com os filtros atuais.</p>
                    <button type="button" className="btn-secondary page-admin-empty-clear" onClick={clearFilters}>
                      Limpar filtros
                    </button>
                  </div>
                ) : (
                  <ul className="page-admin-usuarios-cards" aria-label="Lista de usuários">
                    {pageRows.map((row) => {
                      const isEditing = editingUserId === row.id
                      const isPrincipal = isSuperAdminEmail(row.email)
                      return (
                        <li key={row.id}>
                          <AdminUsuarioCard
                            row={row}
                            isEditing={isEditing}
                            isPrincipal={isPrincipal}
                            principalPodeDarAdmin={principalPodeDarAdmin}
                            roleOptionsEdit={roleOptionsEdit}
                            editForm={editForm}
                            onChangeField={handleChangeField}
                            onSaveUser={handleSaveUser}
                            onCancelEdit={handleCancelEdit}
                            onOpenDetail={setDetailUser}
                            onStartEdit={handleEditUser}
                            onWhatsapp={handleResetPasswordWhatsapp}
                            onDelete={handleDeleteUser}
                            getUserConnectionBadge={getUserConnectionBadge}
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {!loadingUsuarios && totalLista > 0 ? (
                <nav className="page-admin-pagination" aria-label="Paginação da lista de usuários">
                  <span className="page-admin-pagination-info">
                    {totalLista === 0
                      ? '—'
                      : `${start + 1}–${Math.min(start + PAGE_SIZE, totalLista)} de ${totalLista}`}
                  </span>
                  <div className="page-admin-pagination-btns">
                    <button
                      type="button"
                      className="btn-secondary page-admin-page-btn"
                      disabled={pageSafe <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </button>
                    <span className="page-admin-page-indicator">
                      Página {pageSafe} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary page-admin-page-btn"
                      disabled={pageSafe >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Próxima
                    </button>
                  </div>
                </nav>
              ) : null}

              {detailUser ? (
                <div
                  className="modal-backdrop page-admin-payment-logs-modal-backdrop"
                  onClick={() => setDetailUser(null)}
                  role="presentation"
                >
                  <div
                    className="modal-content page-admin-payment-logs-modal page-admin-usuarios-detail-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="user-detail-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="page-admin-payment-logs-modal__head">
                      <h3 id="user-detail-title">Detalhes do usuário</h3>
                      <button type="button" className="page-admin-payment-logs-modal__close" onClick={() => setDetailUser(null)} aria-label="Fechar">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
                      </button>
                    </div>
                    <div className="page-admin-payment-logs-modal__body">
                      <dl className="page-admin-payment-logs-detail-dl">
                        <dt>Nome</dt>
                        <dd>{detailUser.nome || '—'}</dd>
                        <dt>E-mail</dt>
                        <dd>{detailUser.email || '—'}</dd>
                        <dt>Telefone</dt>
                        <dd>{formatPhoneBRDisplay(detailUser.telefone)}</dd>
                        <dt>Papel</dt>
                        <dd>{roleDisplayLabel(isSuperAdminEmail(detailUser.email) ? 'ADMIN' : detailUser.role)}</dd>
                        <dt>Conta</dt>
                        <dd>{detailUser.is_active === false ? 'Desativada' : 'Ativa'}</dd>
                        <dt>Status financeiro</dt>
                        <dd>
                          <UserAdminStatusBadge paymentStatus={detailUser.paymentStatus} isOverdue={detailUser.isOverdue} />
                        </dd>
                        <dt>Assinatura MP</dt>
                        <dd>{detailUser.subscriptionStatus || '—'}</dd>
                        <dt>Ganho acumulado</dt>
                        <dd>{formatCurrencyBRL(detailUser.accumulatedRevenue)}</dd>
                        <dt>Receita no mês</dt>
                        <dd>{formatCurrencyBRL(detailUser.monthlyRevenue)}</dd>
                        <dt>Último pagamento</dt>
                        <dd>{formatDateTimePtBr(detailUser.lastPaymentDate || detailUser.pagamento_ultimo_em)}</dd>
                        <dt>Próxima cobrança</dt>
                        <dd>{formatDateTimePtBr(detailUser.nextPaymentDate)}</dd>
                        <dt>Fim do trial</dt>
                        <dd>{formatDateTimePtBr(detailUser.trial_ends_at)}</dd>
                        <dt>Último acesso</dt>
                        <dd>{formatDateTimePtBr(detailUser.last_login_at)}</dd>
                        <dt>Cadastro</dt>
                        <dd>{formatDateTimePtBr(detailUser.created_at)}</dd>
                      </dl>
                      <div className="page-admin-usuarios-detail-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            handleEditUser(detailUser)
                            setDetailUser(null)
                          }}
                        >
                          Editar
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => void handleResetPasswordWhatsapp(detailUser)}>
                          Código WhatsApp
                        </button>
                        {!isSuperAdminEmail(detailUser.email) ? (
                          <button type="button" className="btn-secondary" onClick={() => void handleDetailToggleActive()}>
                            {detailUser.is_active === false ? 'Reativar conta' : 'Suspender conta'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}


            </article>
            </RefDashboardScroll>
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmDialog != null}
        title={
          confirmDialog?.kind === 'save-demote'
            ? 'Rebaixar papel de Admin?'
            : confirmDialog?.kind === 'save-deactivate' || confirmDialog?.kind === 'detail-deactivate'
              ? 'Desativar conta?'
              : confirmDialog?.kind === 'delete-user'
                ? 'Excluir usuário permanentemente?'
                : ''
        }
        message={
          confirmDialog?.kind === 'save-demote'
            ? 'Rebaixar este usuário de Admin para outro papel? Ele perderá o menu Administração após atualizar a sessão (login de novo ou Ajustes).'
            : confirmDialog?.kind === 'save-deactivate' || confirmDialog?.kind === 'detail-deactivate'
              ? 'Desativar esta conta? O usuário não conseguirá fazer login.'
              : confirmDialog?.kind === 'delete-user'
                ? (() => {
                    const u = confirmDialog.user
                    const extra = normalizeRoleKey(u.role) === 'ADMIN' ? ' Esta conta tem papel Admin.' : ''
                    return `Excluir permanentemente ${u.email}?${extra} Essa ação é irreversível.`
                  })()
                : ''
        }
        confirmLabel={confirmDialog?.kind === 'delete-user' ? 'Excluir' : 'Confirmar'}
        onConfirm={async () => {
          if (!confirmDialog) return
          if (confirmDialog.kind === 'save-demote') {
            const antes = listaUsuarios.find((row) => row.id === editingUserId)
            if (antes && antes.is_active !== false && editForm.is_active === false) {
              window.setTimeout(() => setConfirmDialog({ kind: 'save-deactivate' }), 0)
            } else {
              await executeSaveUser()
            }
            return
          }
          if (confirmDialog.kind === 'save-deactivate') {
            await executeSaveUser()
            return
          }
          if (confirmDialog.kind === 'delete-user') {
            await executeDeleteUser(confirmDialog.user)
            return
          }
          if (confirmDialog.kind === 'detail-deactivate') {
            await executeDetailToggleActive(false)
          }
        }}
        onClose={() => setConfirmDialog(null)}
      />
    </div>
  )
}

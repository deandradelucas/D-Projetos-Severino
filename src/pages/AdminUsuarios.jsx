import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import AdminDataTableSkeleton from '../components/AdminDataTableSkeleton'
import UserAdminStatusBadge from '../components/admin/UserAdminStatusBadge'
import { apiUrl } from '../lib/apiUrl'
import { formatPhoneBRDisplay } from '../lib/formatPhoneBR'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import {
  buildUsuariosAdminQuery,
  formatDatePtBr,
  formatDateTimePtBr,
  rowsToUsersAdminCsv,
} from '../lib/usersAdmin'
import { isSuperAdminEmail, isSuperAdminSession } from '../lib/superAdmin'
import './dashboard.css'

const USUARIOS_TABLE_HEADERS = [
  'Nome',
  'E-mail',
  'Telefone',
  'Papel',
  'Conta',
  'Status',
  'Assinatura / pagamento',
  'Venc. trial',
  'Próx. cobrança',
  'Ganho acum.',
  'Rec. mês',
  'Último acesso',
  'Ações',
]

const ROLE_OPTIONS = [
  { value: 'USER', label: 'Usuário' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'READONLY', label: 'Somente leitura' },
]

function normalizeRoleKey(role) {
  return String(role || 'USER').trim().toUpperCase()
}

/** Rótulo amigável: Admin, Usuário ou Somente leitura (não o código cru USER/ADMIN). */
function roleDisplayLabel(role) {
  const key = normalizeRoleKey(role)
  const opt = ROLE_OPTIONS.find((o) => o.value === key)
  return opt ? opt.label : key
}

function rolePillClassName(role) {
  const k = normalizeRoleKey(role)
  if (k === 'ADMIN') return 'page-admin-role-pill page-admin-role-pill--admin'
  if (k === 'READONLY') return 'page-admin-role-pill page-admin-role-pill--readonly'
  return 'page-admin-role-pill page-admin-role-pill--user'
}

const PAGE_SIZE = 12

const ROLE_OPTIONS_NON_SUPER = ROLE_OPTIONS.filter((o) => o.value !== 'ADMIN')

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function mpStatusLabel(status) {
  if (!status) return '—'
  const s = String(status).toLowerCase()
  if (s === 'approved' || s === 'authorized') return 'Aprovado'
  if (s === 'pending' || s === 'in_process' || s === 'in_mediation') return 'Pendente'
  if (s === 'rejected' || s === 'cancelled' || s === 'refunded' || s === 'charged_back') return 'Recusado / estornado'
  return String(status)
}

function formatRelativeAgo(date) {
  const diffMin = (Date.now() - date.getTime()) / 60000
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${Math.floor(diffMin)} min`
  if (diffMin < 1440) return `há ${Math.floor(diffMin / 60)} h`
  return `há ${Math.floor(diffMin / 1440)} d`
}

function AssinaturaPagamentoCell({ row, isEditing, editForm, onField }) {
  if (isEditing) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!editForm.isento_pagamento} onChange={(e) => onField('isento_pagamento', e.target.checked)} />
        Isento de pagamento
      </label>
    )
  }

  if (row.isento_pagamento === true) {
    return (
      <div>
        <span className="admin-pill" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>
          Isento
        </span>
        <div className="admin-subline">Sem cobrança Mercado Pago</div>
      </div>
    )
  }

  if (row.pagamento_aprovado) {
    const amt =
      row.mp_ultimo_amount != null && row.mp_ultimo_amount !== ''
        ? `R$ ${Number(row.mp_ultimo_amount).toFixed(2)}`
        : null
    const quando = row.mp_ultimo_em ? new Date(row.mp_ultimo_em) : null
    return (
      <div>
        <span className="admin-pill" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d' }}>
          Assinatura paga
        </span>
        {amt && <div className="admin-subline">{amt}</div>}
        {quando && !Number.isNaN(quando.getTime()) && (
          <div className="admin-subline">Atualizado {quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
        )}
      </div>
    )
  }

  const trialEnd = row.trial_ends_at ? new Date(row.trial_ends_at) : null
  const trialValid = trialEnd && !Number.isNaN(trialEnd.getTime())

  if (!trialValid) {
    return (
      <div>
        <span className="admin-pill" style={{ backgroundColor: 'rgba(148,163,184,0.2)', color: 'var(--text-secondary)' }}>
          Sem trial
        </span>
        <div className="admin-subline">Ainda sem período de teste (ex.: primeiro login não registrou)</div>
        {row.mp_ultimo_status && (
          <div className="admin-subline">Último MP: {mpStatusLabel(row.mp_ultimo_status)}</div>
        )}
      </div>
    )
  }

  const trialActive = trialEnd > new Date()
  if (trialActive) {
    return (
      <div>
        <span className="admin-pill" style={{ backgroundColor: 'rgba(99,102,241,0.18)', color: '#4f46e5' }}>
          Teste ativo
        </span>
        <div className="admin-subline">Até {trialEnd.toLocaleDateString('pt-BR', { dateStyle: 'long' })}</div>
        {row.mp_ultimo_status && (
          <div className="admin-subline">Último MP: {mpStatusLabel(row.mp_ultimo_status)}</div>
        )}
      </div>
    )
  }

  return (
    <div>
      <span className="admin-pill" style={{ backgroundColor: 'rgba(234,179,8,0.2)', color: '#a16207' }}>
        Teste encerrado
      </span>
      <div className="admin-subline">Sem pagamento aprovado</div>
      {row.mp_ultimo_status && (
        <div className="admin-subline">Último MP: {mpStatusLabel(row.mp_ultimo_status)}</div>
      )}
    </div>
  )
}

function UltimoAcessoCell({ row, getUserConnectionBadge }) {
  if (!row.last_login_at) {
    return (
      <div>
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Nunca acessou</div>
        <div className="admin-subline">Nenhum login registrado no sistema</div>
      </div>
    )
  }

  const when = new Date(row.last_login_at)
  if (Number.isNaN(when.getTime())) {
    const badgeBad = getUserConnectionBadge(row)
    return (
      <div>
        <div style={{ fontWeight: 600, fontSize: '13px' }}>Data inválida</div>
        {badgeBad ? <div style={{ marginTop: 8 }}>{badgeBad}</div> : null}
      </div>
    )
  }

  const formatted = when.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const rel = formatRelativeAgo(when)
  const badge = getUserConnectionBadge(row)

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{formatted}</div>
      <div className="admin-subline">{rel}</div>
      {badge ? <div style={{ marginTop: 8 }}>{badge}</div> : null}
    </div>
  )
}

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
  const [auditRows, setAuditRows] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

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
      const u = JSON.parse(userSaved)
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
      const res = await fetch(apiUrl(`/api/admin/usuarios?${qs}`), { headers: { 'x-user-id': u.id } })
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

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

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

  const loadAudit = useCallback(async () => {
    setAuditLoading(true)
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) return
      const u = JSON.parse(userSaved)
      const res = await fetch(apiUrl('/api/admin/audit-log?limit=80'), { headers: { 'x-user-id': u.id } })
      const data = await res.json().catch(() => [])
      setAuditRows(Array.isArray(data) ? data : [])
    } catch {
      setAuditRows([])
    } finally {
      setAuditLoading(false)
    }
  }, [])

  useEffect(() => {
    if (auditOpen) void loadAudit()
  }, [auditOpen, loadAudit])

  const exportarCsv = async () => {
    setExportingCsv(true)
    setUserActionMessage('')
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)
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
      const res = await fetch(apiUrl(`/api/admin/usuarios?${qs}`), { headers: { 'x-user-id': u.id } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Falha ao exportar.')
      const items = Array.isArray(data.items) ? data.items : []
      const csv = rowsToUsersAdminCsv(items)
      const bom = '\uFEFF'
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

  const handleSaveUser = async () => {
    if (!editingUserId) return
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)

      const antes = listaUsuarios.find((row) => row.id === editingUserId)
      if (antes) {
        if (normalizeRoleKey(antes.role) === 'ADMIN' && normalizeRoleKey(editForm.role) !== 'ADMIN') {
          const ok = window.confirm(
            'Rebaixar este usuário de Admin para outro papel? Ele perderá o menu Administração após atualizar a sessão (login de novo ou Ajustes).'
          )
          if (!ok) return
        }
        if (antes.is_active !== false && editForm.is_active === false) {
          const ok2 = window.confirm('Desativar esta conta? O usuário não conseguirá fazer login.')
          if (!ok2) return
        }
      }

      const res = await fetch(apiUrl(`/api/admin/usuarios/${editingUserId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': u.id,
        },
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

  const handleDeleteUser = async (user) => {
    const extra = normalizeRoleKey(user.role) === 'ADMIN' ? ' Esta conta tem papel Admin.' : ''
    if (!window.confirm(`Excluir permanentemente ${user.email}?${extra} Essa ação é irreversível.`)) {
      return
    }
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)

      const res = await fetch(apiUrl(`/api/admin/usuarios/${user.id}`), {
        method: 'DELETE',
        headers: { 'x-user-id': u.id },
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

  const handleResetPassword = async (user) => {
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)
      const res = await fetch(apiUrl(`/api/admin/usuarios/${user.id}/solicitar-reset-senha`), {
        method: 'POST',
        headers: { 'x-user-id': u.id },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Falha ao enviar link de redefinição.')
      if (data.devResetUrl) {
        setUserActionMessage(`Ambiente dev (sem Resend): ${data.devResetUrl}`)
      } else {
        setUserActionMessage(`Se o e-mail existir no cadastro, enviamos o link para ${user.email}.`)
      }
      void loadAudit()
    } catch (e) {
      setUserActionMessage(e.message)
    }
  }

  const handleDetailToggleActive = async () => {
    if (!detailUser || isSuperAdminEmail(detailUser.email)) return
    const currentlyActive = detailUser.is_active !== false
    const nextActive = !currentlyActive
    if (currentlyActive && !window.confirm('Desativar esta conta? O usuário não conseguirá fazer login.')) {
      return
    }
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)
      const res = await fetch(apiUrl(`/api/admin/usuarios/${detailUser.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': u.id },
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
    <div className="dashboard-container page-admin page-admin-usuarios ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
            <section className="dashboard-hub__hero page-admin__hero" aria-label="Usuários">
              <div className="dashboard-hub__hero-row">
                <MobileMenuButton onClick={() => setMenuAberto(true)} />
                <div className="dashboard-hub__hero-text">
                  <h1 className="dashboard-hub__title">Usuários</h1>
                  <p className="ref-panel__subtitle page-admin-header-sub">
                    Cadastros, acessos, assinaturas e acompanhamento financeiro
                  </p>
                </div>
              </div>
            </section>

            <article
              className="ref-panel page-admin-ref-panel page-admin-ref-panel--table page-admin-usuarios-panel"
              aria-labelledby="admin-users-heading"
            >
              <div className="ref-panel__head page-admin-usuarios-panel-head">
                <div>
                  <h2 id="admin-users-heading" className="ref-panel__title">
                    Cadastros e acessos
                  </h2>
                  <p className="ref-panel__subtitle page-admin-usuarios-intro">
                    Filtre por cadastro, acesso, assinatura e receita. Apenas o administrador principal pode promover alguém a Admin. Edite linhas, redefina senha ou exclua contas (exceto a administradora principal).
                  </p>
                </div>
                <div className="page-admin-usuarios-head-actions">
                  <Link to="/cadastro" className="btn-secondary page-admin-btn-novo-cadastro">
                    Nova conta
                  </Link>
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

              {stats && !loadError ? (
                <>
                  <section className="ref-kpi-row page-admin-kpi-row page-admin-usuarios-kpis" aria-label="Indicadores do cadastro">
                    <article className="ref-kpi-card ref-kpi-card--balance ref-kpi-card--hero">
                      <div className="ref-kpi-card__body">
                        <p className="ref-kpi-card__label">Cadastros</p>
                        <p className="ref-kpi-card__value">{stats.total}</p>
                        <p className="page-admin-kpi-sub">Total no sistema</p>
                      </div>
                    </article>
                    <article className="ref-kpi-card ref-kpi-card--income">
                      <div className="ref-kpi-card__body">
                        <p className="ref-kpi-card__label">Contas ativas</p>
                        <p className="ref-kpi-card__value">{stats.ativos}</p>
                        <p className="page-admin-kpi-sub">Podem acessar o app</p>
                      </div>
                    </article>
                    <article className="ref-kpi-card ref-kpi-card--expense">
                      <div className="ref-kpi-card__body">
                        <p className="ref-kpi-card__label">Admins</p>
                        <p className="ref-kpi-card__value">{stats.admins}</p>
                        <p className="page-admin-kpi-sub">Papel Admin no banco</p>
                      </div>
                    </article>
                    <article className="ref-kpi-card ref-kpi-card--balance">
                      <div className="ref-kpi-card__body">
                        <p className="ref-kpi-card__label">Trial ativo</p>
                        <p className="ref-kpi-card__value">{stats.trial_ativos}</p>
                        <p className="page-admin-kpi-sub">Teste vigente (data futura)</p>
                      </div>
                    </article>
                  </section>
                  <section className="ref-kpi-row page-admin-kpi-row page-admin-usuarios-kpis page-admin-usuarios-kpis--finance" aria-label="Indicadores financeiros">
                    <article className="ref-kpi-card ref-kpi-card--income">
                      <div className="ref-kpi-card__body">
                        <p className="ref-kpi-card__label">Assinaturas pagas</p>
                        <p className="ref-kpi-card__value">{stats.assinaturas_pagas ?? '—'}</p>
                        <p className="page-admin-kpi-sub">Usuários com pagamento aprovado</p>
                      </div>
                    </article>
                    <article className="ref-kpi-card ref-kpi-card--income ref-kpi-card--hero">
                      <div className="ref-kpi-card__body">
                        <p className="ref-kpi-card__label">Ganho acumulado</p>
                        <p className="ref-kpi-card__value">{formatCurrencyBRL(stats.ganho_acumulado_total ?? 0)}</p>
                        <p className="page-admin-kpi-sub">Soma de pagamentos aprovados (MP)</p>
                      </div>
                    </article>
                    <article className="ref-kpi-card ref-kpi-card--balance">
                      <div className="ref-kpi-card__body">
                        <p className="ref-kpi-card__label">Receita mensal</p>
                        <p className="ref-kpi-card__value">{formatCurrencyBRL(stats.receita_mensal_total ?? 0)}</p>
                        <p className="page-admin-kpi-sub">Aprovados no mês (UTC)</p>
                      </div>
                    </article>
                    <article className="ref-kpi-card ref-kpi-card--expense">
                      <div className="ref-kpi-card__body">
                        <p className="ref-kpi-card__label">Próximo pagamento</p>
                        <p className="ref-kpi-card__value page-admin-usuarios-kpi-sm">{formatDateTimePtBr(stats.proximo_pagamento)}</p>
                        <p className="page-admin-kpi-sub">Menor data futura de cobrança</p>
                      </div>
                    </article>
                    <article className="ref-kpi-card ref-kpi-card--expense">
                      <div className="ref-kpi-card__body">
                        <p className="ref-kpi-card__label">Próximo vencimento</p>
                        <p className="ref-kpi-card__value page-admin-usuarios-kpi-sm">{formatDatePtBr(stats.proximo_vencimento)}</p>
                        <p className="page-admin-kpi-sub">Trial ou cobrança (o que ocorrer antes)</p>
                      </div>
                    </article>
                    <article className="ref-kpi-card ref-kpi-card--balance">
                      <div className="ref-kpi-card__body">
                        <p className="ref-kpi-card__label">Sem login recente</p>
                        <p className="ref-kpi-card__value">{stats.contas_sem_login_recente ?? '—'}</p>
                        <p className="page-admin-kpi-sub">Ativos sem acesso há 30 dias</p>
                      </div>
                    </article>
                  </section>
                  <section className="page-admin-usuarios-insights" aria-label="Insights">
                    <div className="page-admin-usuarios-insight-card">
                      <span className="page-admin-usuarios-insight-k">Trials vencidos (conta ativa)</span>
                      <span className="page-admin-usuarios-insight-v">{stats.trials_vencidos_conta ?? '—'}</span>
                    </div>
                    <div className="page-admin-usuarios-insight-card">
                      <span className="page-admin-usuarios-insight-k">Ticket médio / usuário pagante</span>
                      <span className="page-admin-usuarios-insight-v">{formatCurrencyBRL(stats.ticket_medio_usuario ?? 0)}</span>
                    </div>
                  </section>
                </>
              ) : null}

              <div className="page-admin-users-toolbar page-admin-users-toolbar--grid">
                <div className="page-admin-search-wrap">
                  <span className="page-admin-search-icon" aria-hidden>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </span>
                  <input
                    type="search"
                    className="page-admin-filter-input page-admin-filter-input--search"
                    placeholder="Buscar nome, e-mail, telefone ou id…"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <label className="page-admin-filter-label">
                  <span>Papel</span>
                  <select
                    className="page-admin-filter-select"
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="page-admin-filter-label">
                  <span>Conta</span>
                  <select className="page-admin-filter-select" value={filterConta} onChange={(e) => setFilterConta(e.target.value)}>
                    <option value="">Todas</option>
                    <option value="ativo">Ativa</option>
                    <option value="inativo">Desativada</option>
                  </select>
                </label>
                <label className="page-admin-filter-label">
                  <span>Ordenar</span>
                  <select className="page-admin-filter-select" value={filterSort} onChange={(e) => setFilterSort(e.target.value)}>
                    <option value="email_asc">E-mail A–Z</option>
                    <option value="email_desc">E-mail Z–A</option>
                    <option value="nome_asc">Nome A–Z</option>
                    <option value="nome_desc">Nome Z–A</option>
                    <option value="last_login_desc">Último acesso ↓</option>
                    <option value="last_login_asc">Último acesso ↑</option>
                    <option value="trial_asc">Venc. trial ↑</option>
                    <option value="trial_desc">Venc. trial ↓</option>
                    <option value="next_pay_asc">Próx. cobrança ↑</option>
                    <option value="next_pay_desc">Próx. cobrança ↓</option>
                    <option value="revenue_desc">Ganho acumulado ↓</option>
                    <option value="revenue_asc">Ganho acumulado ↑</option>
                    <option value="created_desc">Cadastro ↓</option>
                    <option value="created_asc">Cadastro ↑</option>
                  </select>
                </label>
                <label className="page-admin-filter-label">
                  <span>Assinatura</span>
                  <select className="page-admin-filter-select" value={filterAssinatura} onChange={(e) => setFilterAssinatura(e.target.value)}>
                    <option value="">Todas</option>
                    <option value="pago">Com pagamento aprovado</option>
                    <option value="nao_pago">Sem pagamento aprovado</option>
                    <option value="trial">Em trial</option>
                    <option value="isento">Isentos</option>
                    <option value="inadimplente">Inadimplentes (trial vencido)</option>
                  </select>
                </label>
                <label className="page-admin-filter-label">
                  <span>Acesso</span>
                  <select className="page-admin-filter-select" value={filterLogin} onChange={(e) => setFilterLogin(e.target.value)}>
                    <option value="">Qualquer</option>
                    <option value="nunca">Nunca acessou</option>
                    <option value="stale">Sem login há 30 dias</option>
                  </select>
                </label>
                <div className="page-admin-toolbar-btns">
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
                  <button type="button" className="btn-secondary page-admin-toolbar-btn" onClick={clearFilters}>
                    Limpar filtros
                  </button>
                </div>
              </div>

              <div className="page-admin-usuarios-adv-filters">
                <p className="page-admin-usuarios-adv-title">Períodos e datas</p>
                <div className="page-admin-usuarios-adv-grid">
                  <label className="page-admin-filter-label">
                    <span>Cadastro de</span>
                    <input
                      type="date"
                      className="page-admin-filter-input"
                      value={filterCreatedFrom}
                      onChange={(e) => setFilterCreatedFrom(e.target.value)}
                    />
                  </label>
                  <label className="page-admin-filter-label">
                    <span>até</span>
                    <input type="date" className="page-admin-filter-input" value={filterCreatedTo} onChange={(e) => setFilterCreatedTo(e.target.value)} />
                  </label>
                  <label className="page-admin-filter-label">
                    <span>Último acesso de</span>
                    <input
                      type="date"
                      className="page-admin-filter-input"
                      value={filterAccessFrom}
                      onChange={(e) => setFilterAccessFrom(e.target.value)}
                    />
                  </label>
                  <label className="page-admin-filter-label">
                    <span>até</span>
                    <input type="date" className="page-admin-filter-input" value={filterAccessTo} onChange={(e) => setFilterAccessTo(e.target.value)} />
                  </label>
                  <label className="page-admin-filter-label">
                    <span>Próx. cobrança de</span>
                    <input type="date" className="page-admin-filter-input" value={filterPayFrom} onChange={(e) => setFilterPayFrom(e.target.value)} />
                  </label>
                  <label className="page-admin-filter-label">
                    <span>até</span>
                    <input type="date" className="page-admin-filter-input" value={filterPayTo} onChange={(e) => setFilterPayTo(e.target.value)} />
                  </label>
                  <label className="page-admin-filter-label">
                    <span>Fim do trial de</span>
                    <input
                      type="date"
                      className="page-admin-filter-input"
                      value={filterTrialEndsFrom}
                      onChange={(e) => setFilterTrialEndsFrom(e.target.value)}
                    />
                  </label>
                  <label className="page-admin-filter-label">
                    <span>até</span>
                    <input
                      type="date"
                      className="page-admin-filter-input"
                      value={filterTrialEndsTo}
                      onChange={(e) => setFilterTrialEndsTo(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <p className="page-admin-usuarios-meta" aria-live="polite">
                {loadingUsuarios
                  ? 'Carregando…'
                  : (() => {
                      const base = `${totalLista} ${totalLista === 1 ? 'resultado' : 'resultados'} nesta página`
                      if (!stats) return base
                      return `${base} · ${stats.total} cadastro(s) no sistema`
                    })()}
              </p>

              <div className="page-admin-table-scroll">
                {loadingUsuarios ? (
                  <AdminDataTableSkeleton headers={USUARIOS_TABLE_HEADERS} rows={10} tableClassName="admin-usuarios-table" />
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
                  <>
                  <table className="admin-usuarios-table admin-usuarios-table--enhanced admin-usuarios-table--desktop">
                    <thead>
                      <tr>
                        <th className="cell-nome">Nome</th>
                        <th className="cell-email">E-mail</th>
                        <th className="cell-fone page-admin-usuarios-col--md">Telefone</th>
                        <th>Papel</th>
                        <th>Conta</th>
                        <th className="cell-status-fin">Status</th>
                        <th className="cell-assinatura">Assinatura / pagamento</th>
                        <th className="page-admin-usuarios-col--sm">Venc. trial</th>
                        <th className="page-admin-usuarios-col--sm">Próx. cobr.</th>
                        <th className="page-admin-usuarios-col--num">Ganho</th>
                        <th className="page-admin-usuarios-col--num page-admin-usuarios-col--md">Mês</th>
                        <th className="cell-acesso">Último acesso</th>
                        <th className="cell-acoes">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => {
                        const isEditing = editingUserId === row.id
                        const isPrincipal = isSuperAdminEmail(row.email)
                        return (
                          <tr key={row.id} className={row.isOverdue ? 'admin-usuarios-tr--alert' : undefined}>
                            <td className="cell-nome">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.nome}
                                  onChange={(e) => handleChangeField('nome', e.target.value)}
                                  className="page-admin-inline-input"
                                />
                              ) : (
                                <span className="page-admin-cell-strong">{row.nome || '—'}</span>
                              )}
                            </td>
                            <td className="cell-email">
                              {isEditing ? (
                                <input
                                  type="email"
                                  value={editForm.email}
                                  onChange={(e) => handleChangeField('email', e.target.value)}
                                  className="page-admin-inline-input"
                                  disabled={isPrincipal}
                                  title={isPrincipal ? 'E-mail da conta administradora principal não pode ser alterado.' : undefined}
                                />
                              ) : (
                                <span title={row.email}>{row.email}</span>
                              )}
                            </td>
                            <td className="cell-fone">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.telefone}
                                  onChange={(e) => handleChangeField('telefone', e.target.value)}
                                  className="page-admin-inline-input"
                                  placeholder="DDD + número"
                                />
                              ) : (
                                formatPhoneBRDisplay(row.telefone)
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                isPrincipal ? (
                                  <span
                                    className={rolePillClassName('ADMIN')}
                                    title="A conta principal permanece como administradora."
                                  >
                                    {roleDisplayLabel('ADMIN')}
                                  </span>
                                ) : !principalPodeDarAdmin && normalizeRoleKey(editForm.role) === 'ADMIN' ? (
                                  <span
                                    className={rolePillClassName('ADMIN')}
                                    title="Somente o administrador principal pode alterar ou rebaixar outro Admin."
                                  >
                                    {roleDisplayLabel('ADMIN')}
                                  </span>
                                ) : (
                                  <select
                                    className="page-admin-filter-select page-admin-filter-select--inline"
                                    value={editForm.role || 'USER'}
                                    onChange={(e) => handleChangeField('role', e.target.value)}
                                  >
                                    {roleOptionsEdit.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                )
                              ) : (
                                <span className={rolePillClassName(isPrincipal ? 'ADMIN' : row.role)}>
                                  {roleDisplayLabel(isPrincipal ? 'ADMIN' : row.role)}
                                </span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <label className="page-admin-checkbox-ativo">
                                  <input
                                    type="checkbox"
                                    checked={editForm.is_active}
                                    onChange={(e) => handleChangeField('is_active', e.target.checked)}
                                  />
                                  Ativo
                                </label>
                              ) : row.is_active === false ? (
                                <span className="admin-badge-conta admin-badge-conta--off">Desativado</span>
                              ) : (
                                <span className="admin-badge-conta admin-badge-conta--on">Ativo</span>
                              )}
                            </td>
                            <td className="cell-status-fin">
                              <UserAdminStatusBadge paymentStatus={row.paymentStatus} isOverdue={row.isOverdue} />
                              {row.daysToExpire != null && row.daysToExpire >= 0 ? (
                                <div className="admin-subline">{row.daysToExpire} d</div>
                              ) : null}
                            </td>
                            <td className="cell-assinatura">
                              <AssinaturaPagamentoCell
                                row={row}
                                isEditing={isEditing}
                                editForm={editForm}
                                onField={handleChangeField}
                              />
                            </td>
                            <td className="page-admin-usuarios-col--sm">{formatDatePtBr(row.trial_ends_at)}</td>
                            <td className="page-admin-usuarios-col--sm">{formatDateTimePtBr(row.nextPaymentDate)}</td>
                            <td className="page-admin-usuarios-col--num">{formatCurrencyBRL(row.accumulatedRevenue)}</td>
                            <td className="page-admin-usuarios-col--num">{formatCurrencyBRL(row.monthlyRevenue)}</td>
                            <td className="cell-acesso">
                              <UltimoAcessoCell row={row} getUserConnectionBadge={getUserConnectionBadge} />
                            </td>
                            <td className="cell-acoes">
                              <details className="page-admin-acoes-dd">
                                <summary className="page-admin-acoes-dd-summary">Ações</summary>
                                <div className="page-admin-acoes-dd-body">
                                  {isEditing ? (
                                    <>
                                      <button type="button" className="btn-primary admin-acoes-btn" onClick={handleSaveUser}>
                                        Salvar
                                      </button>
                                      <button type="button" className="btn-secondary admin-acoes-btn" onClick={handleCancelEdit}>
                                        Cancelar
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => setDetailUser(row)}>
                                        Detalhes
                                      </button>
                                      <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => handleEditUser(row)}>
                                        Editar
                                      </button>
                                    </>
                                  )}
                                  <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => handleResetPassword(row)}>
                                    Senha
                                  </button>
                                  {isPrincipal ? (
                                    <span className="admin-acoes-protegido" title="A conta administradora principal não pode ser excluída pelo painel.">
                                      Protegido
                                    </span>
                                  ) : (
                                    <button type="button" className="btn-secondary admin-acoes-btn admin-acoes-btn--danger" onClick={() => handleDeleteUser(row)}>
                                      Excluir
                                    </button>
                                  )}
                                </div>
                              </details>
                              <div className="admin-acoes-btns page-admin-acoes-desktop">
                                {isEditing ? (
                                  <>
                                    <button type="button" className="btn-primary admin-acoes-btn" onClick={handleSaveUser}>
                                      Salvar
                                    </button>
                                    <button type="button" className="btn-secondary admin-acoes-btn" onClick={handleCancelEdit}>
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => setDetailUser(row)}>
                                      Detalhes
                                    </button>
                                    <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => handleEditUser(row)}>
                                      Editar
                                    </button>
                                  </>
                                )}
                                <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => handleResetPassword(row)}>
                                  Senha
                                </button>
                                {isPrincipal ? (
                                  <span
                                    className="admin-acoes-protegido"
                                    title="A conta administradora principal não pode ser excluída pelo painel."
                                  >
                                    Protegido
                                  </span>
                                ) : (
                                  <button type="button" className="btn-secondary admin-acoes-btn admin-acoes-btn--danger" onClick={() => handleDeleteUser(row)}>
                                    Excluir
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <ul className="page-admin-usuarios-mobile-list" aria-label="Lista de usuários">
                    {pageRows.map((row) => {
                      const isPrincipal = isSuperAdminEmail(row.email)
                      return (
                        <li key={row.id}>
                          <button type="button" className="page-admin-usuarios-mobile-card" onClick={() => setDetailUser(row)}>
                            <div className="page-admin-usuarios-mobile-top">
                              <span className="page-admin-usuarios-mobile-name">{row.nome || row.email || '—'}</span>
                              <UserAdminStatusBadge paymentStatus={row.paymentStatus} isOverdue={row.isOverdue} />
                            </div>
                            <p className="page-admin-usuarios-mobile-email">{row.email}</p>
                            <div className="page-admin-usuarios-mobile-row">
                              <span>{formatCurrencyBRL(row.accumulatedRevenue)}</span>
                              <span className="page-admin-usuarios-mobile-muted">{formatDateTimePtBr(row.last_login_at)}</span>
                            </div>
                            <div className="page-admin-usuarios-mobile-actions">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDetailUser(row)
                                }}
                              >
                                Detalhes
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditUser(row)
                                }}
                              >
                                Editar
                              </button>
                              {!isPrincipal ? (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleResetPassword(row)
                                  }}
                                >
                                  Senha
                                </button>
                              ) : null}
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  </>
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
                        ×
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
                        <dd>{formatDateTimePtBr(detailUser.lastPaymentDate || detailUser.mp_ultimo_em)}</dd>
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
                        <button type="button" className="btn-secondary" onClick={() => void handleResetPassword(detailUser)}>
                          Redefinir senha
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

              <details className="page-admin-audit-block" onToggle={(e) => setAuditOpen(e.target.open)}>
                <summary className="page-admin-audit-summary">Auditoria recente (ações registradas no servidor)</summary>
                {auditLoading ? (
                  <p className="page-admin-audit-loading">Carregando…</p>
                ) : auditRows.length === 0 ? (
                  <p className="page-admin-audit-empty">
                    Nenhum registro ainda. Se acabou de subir o projeto, rode a migration <code>13_admin_audit_log.sql</code> no Supabase.
                  </p>
                ) : (
                  <ul className="page-admin-audit-list">
                    {auditRows.map((row) => (
                      <li key={row.id} className="page-admin-audit-item">
                        <span className="page-admin-audit-time">{new Date(row.created_at).toLocaleString('pt-BR')}</span>
                        <span className="page-admin-audit-action">{row.action}</span>
                        <span className="page-admin-audit-target">{row.target_email || row.target_user_id || '—'}</span>
                        {row.client_ip ? <span className="page-admin-audit-ip">{row.client_ip}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </article>
            </RefDashboardScroll>
          </div>
        </main>
      </div>
    </div>
  )
}

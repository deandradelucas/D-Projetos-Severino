import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { SkeletonKpi } from '../components/dashboard/DashboardSkeletons'
import UserAdminStatusBadge from '../components/admin/UserAdminStatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import { apiUrl } from '../lib/apiUrl'
import { formatPhoneBRDisplay } from '../lib/formatPhoneBR'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import {
  buildUsuariosAdminQuery,
  formatDatePtBr,
  formatDateTimePtBr,
  rowsToUsersAdminCsv,
} from '../lib/usersAdmin'
import { pagamentoStatusLabelPt } from '../lib/pagamentoPageModel.js'
import { isSuperAdminEmail, isSuperAdminSession } from '../lib/superAdmin'
import './dashboard.css'

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
        <div className="admin-subline">Sem cobrança Asaas</div>
      </div>
    )
  }

  if (row.pagamento_aprovado) {
    const amt =
      row.pagamento_ultimo_amount != null && row.pagamento_ultimo_amount !== ''
        ? `R$ ${Number(row.pagamento_ultimo_amount).toFixed(2)}`
        : null
    const quando = row.pagamento_ultimo_em ? new Date(row.pagamento_ultimo_em) : null
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
        {row.pagamento_ultimo_status && (
          <div className="admin-subline">Última cobrança: {pagamentoStatusLabelPt(row.pagamento_ultimo_status)}</div>
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
        {row.pagamento_ultimo_status && (
          <div className="admin-subline">Última cobrança: {pagamentoStatusLabelPt(row.pagamento_ultimo_status)}</div>
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
      {row.pagamento_ultimo_status && (
        <div className="admin-subline">Última cobrança: {pagamentoStatusLabelPt(row.pagamento_ultimo_status)}</div>
      )}
    </div>
  )
}

function UltimoAcessoCell({ row, getUserConnectionBadge }) {
  if (!row.last_login_at) {
    return (
      <div className="page-admin-usuarios-acesso-stack">
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Nunca acessou</div>
        <div className="admin-subline">Nenhum login registrado no sistema</div>
      </div>
    )
  }

  const when = new Date(row.last_login_at)
  if (Number.isNaN(when.getTime())) {
    const badgeBad = getUserConnectionBadge(row)
    return (
      <div className="page-admin-usuarios-acesso-stack">
        <div style={{ fontWeight: 600, fontSize: '13px' }}>Data inválida</div>
        {badgeBad ? <div>{badgeBad}</div> : null}
      </div>
    )
  }

  const formatted = when.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const rel = formatRelativeAgo(when)
  const badge = getUserConnectionBadge(row)

  return (
    <div className="page-admin-usuarios-acesso-stack">
      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{formatted}</div>
      <div className="admin-subline">{rel}</div>
      {badge ? <div className="page-admin-usuarios-acesso-badge">{badge}</div> : null}
    </div>
  )
}

function AdminUsuarioCard({
  row,
  isEditing,
  isPrincipal,
  principalPodeDarAdmin,
  roleOptionsEdit,
  editForm,
  onChangeField,
  onSaveUser,
  onCancelEdit,
  onOpenDetail,
  onStartEdit,
  onWhatsapp,
  onDelete,
  getUserConnectionBadge,
}) {
  const cardClass = [
    'page-admin-usuario-card',
    row.isOverdue ? 'page-admin-usuario-card--alert' : '',
    isEditing ? 'page-admin-usuario-card--editing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={cardClass} aria-label={row.nome || row.email || 'Usuário'}>
      <header className="page-admin-usuario-card__head">
        <div className="page-admin-usuario-card__head-text">
          {isEditing ? (
            <input
              type="text"
              className="page-admin-inline-input page-admin-usuario-card__input-name"
              value={editForm.nome}
              onChange={(e) => onChangeField('nome', e.target.value)}
              aria-label="Nome"
            />
          ) : (
            <h3 className="page-admin-usuario-card__name">{row.nome || '—'}</h3>
          )}
          {isEditing ? (
            <input
              type="email"
              className="page-admin-inline-input page-admin-usuario-card__input-email"
              value={editForm.email}
              onChange={(e) => onChangeField('email', e.target.value)}
              disabled={isPrincipal}
              title={isPrincipal ? 'E-mail da conta administradora principal não pode ser alterado.' : undefined}
              aria-label="E-mail"
            />
          ) : (
            <p className="page-admin-usuario-card__email page-admin-email-text">{row.email}</p>
          )}
        </div>
        <div className="page-admin-usuario-card__head-status">
          <UserAdminStatusBadge paymentStatus={row.paymentStatus} isOverdue={row.isOverdue} />
          {row.daysToExpire != null && row.daysToExpire >= 0 ? (
            <span className="page-admin-usuario-card__trial-hint admin-subline">{row.daysToExpire} d</span>
          ) : null}
        </div>
      </header>

      <div className="page-admin-usuario-card__grid">
        <div className="page-admin-usuario-card__field">
          <span className="page-admin-usuario-card__label">Telefone</span>
          <div className="page-admin-usuario-card__value">
            {isEditing ? (
              <input
                type="text"
                className="page-admin-inline-input"
                value={editForm.telefone}
                onChange={(e) => onChangeField('telefone', e.target.value)}
                placeholder="DDD + número"
              />
            ) : (
              formatPhoneBRDisplay(row.telefone)
            )}
          </div>
        </div>

        <div className="page-admin-usuario-card__field">
          <span className="page-admin-usuario-card__label">Papel · conta</span>
          <div className="page-admin-usuario-card__value">
            <div className="page-admin-usuarios-perfil-stack">
              <div className="page-admin-usuarios-perfil-stack__role">
                {isEditing ? (
                  isPrincipal ? (
                    <span className={rolePillClassName('ADMIN')} title="A conta principal permanece como administradora.">
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
                      className="page-admin-filter-select page-admin-filter-select--inline page-admin-filter-select--perfil"
                      value={editForm.role || 'USER'}
                      onChange={(e) => onChangeField('role', e.target.value)}
                      aria-label="Papel"
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
              </div>
              <div className="page-admin-usuarios-perfil-stack__conta">
                {isEditing ? (
                  <label className="page-admin-checkbox-ativo">
                    <input type="checkbox" checked={editForm.is_active} onChange={(e) => onChangeField('is_active', e.target.checked)} />
                    Conta ativa
                  </label>
                ) : row.is_active === false ? (
                  <span className="admin-badge-conta admin-badge-conta--off">Desativado</span>
                ) : (
                  <span className="admin-badge-conta admin-badge-conta--on">Ativo</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="page-admin-usuario-card__field page-admin-usuario-card__field--wide">
          <span className="page-admin-usuario-card__label">Assinatura / pagamento</span>
          <div className="page-admin-usuario-card__value">
            <AssinaturaPagamentoCell row={row} isEditing={isEditing} editForm={editForm} onField={onChangeField} />
          </div>
        </div>

        <div className="page-admin-usuario-card__field">
          <span className="page-admin-usuario-card__label">Trial / cobrança</span>
          <div className="page-admin-usuario-card__value">
            <div className="page-admin-usuarios-compact-block">
              <div className="page-admin-usuarios-compact-row">
                <span className="page-admin-usuarios-compact-k">Trial</span>
                <span className="page-admin-usuarios-compact-v">{formatDatePtBr(row.trial_ends_at)}</span>
              </div>
              <div className="page-admin-usuarios-compact-row">
                <span className="page-admin-usuarios-compact-k">Cobr.</span>
                <span className="page-admin-usuarios-compact-v">{formatDateTimePtBr(row.nextPaymentDate)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="page-admin-usuario-card__field">
          <span className="page-admin-usuario-card__label">Receita</span>
          <div className="page-admin-usuario-card__value">
            <div className="page-admin-usuarios-compact-block">
              <div className="page-admin-usuarios-compact-row">
                <span className="page-admin-usuarios-compact-k">Acum.</span>
                <span className="page-admin-usuarios-compact-v page-admin-usuarios-compact-v--num">{formatCurrencyBRL(row.accumulatedRevenue)}</span>
              </div>
              <div className="page-admin-usuarios-compact-row">
                <span className="page-admin-usuarios-compact-k">Mês</span>
                <span className="page-admin-usuarios-compact-v page-admin-usuarios-compact-v--num">{formatCurrencyBRL(row.monthlyRevenue)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="page-admin-usuario-card__field page-admin-usuario-card__field--wide">
          <span className="page-admin-usuario-card__label">Último acesso</span>
          <div className="page-admin-usuario-card__value">
            <UltimoAcessoCell row={row} getUserConnectionBadge={getUserConnectionBadge} />
          </div>
        </div>
      </div>

      <footer className="page-admin-usuario-card__footer">
        <div className="admin-acoes-btns page-admin-usuario-card__actions">
          {isEditing ? (
            <>
              <button type="button" className="btn-primary admin-acoes-btn" onClick={onSaveUser}>
                Salvar
              </button>
              <button type="button" className="btn-secondary admin-acoes-btn" onClick={onCancelEdit}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => onOpenDetail(row)}>
                Detalhes
              </button>
              <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => onStartEdit(row)}>
                Editar
              </button>
            </>
          )}
          <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => void onWhatsapp(row)}>
            WhatsApp
          </button>
          {isPrincipal ? (
            <span className="admin-acoes-protegido" title="A conta administradora principal não pode ser excluída pelo painel.">
              Protegido
            </span>
          ) : (
            <button type="button" className="btn-secondary admin-acoes-btn admin-acoes-btn--danger" onClick={() => onDelete(row)}>
              Excluir
            </button>
          )}
        </div>
      </footer>
    </article>
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

  const executeSaveUser = async () => {
    if (!editingUserId) return
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)

      const antes = listaUsuarios.find((row) => row.id === editingUserId)

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

  const handleDeleteUser = (user) => {
    setConfirmDialog({ kind: 'delete-user', user })
  }

  const handleResetPasswordWhatsapp = async (user) => {
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)
      const res = await fetch(apiUrl(`/api/admin/usuarios/${user.id}/solicitar-otp-senha-whatsapp`), {
        method: 'POST',
        headers: { 'x-user-id': u.id },
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
              {loadingUsuarios && !stats ? (
                <>
                  <SkeletonKpi />
                  <SkeletonKpi />
                  <SkeletonKpi />
                  <SkeletonKpi />
                  <SkeletonKpi />
                </>
              ) : stats ? (
                <>
                  <article className="ref-kpi-card ref-kpi-card--balance">
                    <div className="ref-kpi-card__icon" aria-hidden>
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div className="ref-kpi-card__body">
                      <p className="ref-kpi-card__label">Total de cadastros</p>
                      <p className="ref-kpi-card__value">{stats.total}</p>
                    </div>
                  </article>
                  <article className="ref-kpi-card ref-kpi-card--income">
                    <div className="ref-kpi-card__icon" aria-hidden>
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <div className="ref-kpi-card__body">
                      <p className="ref-kpi-card__label">Contas ativas</p>
                      <p className="ref-kpi-card__value">{stats.ativos}</p>
                    </div>
                  </article>
                  <article className="ref-kpi-card ref-kpi-card--expense">
                    <div className="ref-kpi-card__icon" aria-hidden>
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    </div>
                    <div className="ref-kpi-card__body">
                      <p className="ref-kpi-card__label">Administradores</p>
                      <p className="ref-kpi-card__value">{stats.admins}</p>
                    </div>
                  </article>
                  <article className="ref-kpi-card">
                    <div className="ref-kpi-card__icon" aria-hidden>
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="14" x="2" y="5" rx="2" />
                        <line x1="2" x2="22" y1="10" y2="10" />
                      </svg>
                    </div>
                    <div className="ref-kpi-card__body">
                      <p className="ref-kpi-card__label">Assinaturas pagas</p>
                      <p className="ref-kpi-card__value">{stats.assinaturas_pagas}</p>
                    </div>
                  </article>
                  <article className="ref-kpi-card ref-kpi-card--income">
                    <div className="ref-kpi-card__icon" aria-hidden>
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" x2="12" y1="2" y2="22" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>
                    <div className="ref-kpi-card__body">
                      <p className="ref-kpi-card__label">Receita no mês</p>
                      <p className="ref-kpi-card__value">{formatCurrencyBRL(stats.receita_mensal_total ?? 0)}</p>
                    </div>
                  </article>
                </>
              ) : null}
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
                <div
                  id="admin-users-filters-region"
                  className="page-admin-usuarios-filters-region"
                  role="region"
                  aria-labelledby="admin-users-filters-disclosure"
                >
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
                      <select className="page-admin-filter-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
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
                </div>
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

import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import { isSuperAdminEmail } from '../lib/superAdmin'
import './dashboard.css'

const ROLE_OPTIONS = [
  { value: 'USER', label: 'Usuário' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'READONLY', label: 'Somente leitura' },
]

const ROLE_OPTIONS_SEM_ADMIN = ROLE_OPTIONS.filter((o) => o.value !== 'ADMIN')

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
  const [usuarios, setUsuarios] = useState([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [editingUserId, setEditingUserId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [userFilter, setUserFilter] = useState('')
  const [userActionMessage, setUserActionMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoadError('')
      try {
        const userSaved = localStorage.getItem('horizonte_user')
        if (!userSaved) {
          setLoadError('Faça login para carregar os usuários.')
          return
        }
        const u = JSON.parse(userSaved)
        const res = await fetch('/api/admin/usuarios', { headers: { 'x-user-id': u.id } })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          setUsuarios(Array.isArray(data) ? data : [])
        } else {
          setUsuarios([])
          setLoadError(data.message || `Erro ao buscar usuários (${res.status}).`)
        }
      } catch (e) {
        setUsuarios([])
        setLoadError(e.message || 'Falha de rede ao carregar usuários.')
      } finally {
        setLoadingUsuarios(false)
      }
    }
    load()
  }, [])

  const handleEditUser = (user) => {
    setEditingUserId(user.id)
    setEditForm({
      nome: user.nome || '',
      email: user.email || '',
      telefone: user.telefone || '',
      role: user.role || 'USER',
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

      const res = await fetch(`/api/admin/usuarios/${editingUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': u.id,
        },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Falha ao salvar usuário.')

      setUsuarios((prev) => prev.map((row) => (row.id === editingUserId ? data : row)))
      setUserActionMessage('Usuário atualizado com sucesso.')
      setEditingUserId(null)
      setEditForm({})
    } catch (e) {
      setUserActionMessage(e.message)
    }
  }

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${user.email}? Essa ação é irreversível.`)) {
      return
    }
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)

      const res = await fetch(`/api/admin/usuarios/${user.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': u.id },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Falha ao excluir usuário.')

      setUsuarios((prev) => prev.filter((row) => row.id !== user.id))
      setUserActionMessage('Usuário excluído.')
      if (editingUserId === user.id) {
        setEditingUserId(null)
        setEditForm({})
      }
    } catch (e) {
      setUserActionMessage(e.message)
    }
  }

  const handleResetPassword = async (user) => {
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Falha ao enviar link de redefinição.')
      setUserActionMessage(`Link de redefinição enviado para ${user.email}.`)
    } catch (e) {
      setUserActionMessage(e.message)
    }
  }

  const filtrarUsuarios = () => {
    const termo = userFilter.trim().toLowerCase()
    if (!termo) return usuarios
    return usuarios.filter((u) => {
      return (
        String(u.email || '').toLowerCase().includes(termo) ||
        String(u.nome || '').toLowerCase().includes(termo) ||
        String(u.telefone || '').toLowerCase().includes(termo)
      )
    })
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
    <div className="dashboard-container page-admin-usuarios">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <MobileMenuButton onClick={() => setMenuAberto(true)} />
            <div>
              <h1 className="responsive-h1" style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Logs de usuários
              </h1>
              <p className="responsive-p" style={{ color: 'var(--text-secondary)' }}>
                Último login, papéis e gestão de contas
              </p>
            </div>
          </div>
        </header>

        <section className="content-section" style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Veja quem está conectado, ajuste papéis (roles), ative ou desative contas, edite dados e envie links de redefinição de senha.
          </p>

          {loadError && (
            <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', color: '#b91c1c', fontSize: '14px' }}>
              {loadError}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Filtrar por nome, e-mail ou telefone..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              style={{
                flex: '1',
                minWidth: '200px',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(148,163,184,0.4)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            />
            {userActionMessage && (
              <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{userActionMessage}</span>
            )}
          </div>

          {loadingUsuarios ? (
            <p style={{ color: 'var(--text-secondary)' }}>Carregando usuários...</p>
          ) : usuarios.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum usuário encontrado.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-usuarios-table">
                <thead>
                  <tr>
                    <th className="cell-nome">Nome</th>
                    <th className="cell-email">E-mail</th>
                    <th className="cell-fone">Telefone</th>
                    <th>Role</th>
                    <th>Conta</th>
                    <th className="cell-assinatura">Assinatura / pagamento</th>
                    <th className="cell-acesso">Último acesso</th>
                    <th className="cell-acoes">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrarUsuarios().map((row) => {
                    const isEditing = editingUserId === row.id
                    const isPrincipal = isSuperAdminEmail(row.email)
                    return (
                      <tr key={row.id}>
                        <td className="cell-nome">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.nome}
                              onChange={(e) => handleChangeField('nome', e.target.value)}
                              style={{ width: '100%', fontSize: '13px' }}
                            />
                          ) : (
                            <span style={{ fontWeight: '600' }}>{row.nome || '—'}</span>
                          )}
                        </td>
                        <td className="cell-email">
                          {isEditing ? (
                            <input
                              type="email"
                              value={editForm.email}
                              onChange={(e) => handleChangeField('email', e.target.value)}
                              style={{ width: '100%', fontSize: '13px' }}
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
                              style={{ width: '100%', fontSize: '13px' }}
                            />
                          ) : (
                            row.telefone || '—'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            isPrincipal ? (
                              <span style={{ fontSize: '12px', fontWeight: '600' }} title="A conta principal permanece como administradora.">
                                Admin
                              </span>
                            ) : (
                              <select
                                value={editForm.role === 'ADMIN' ? 'USER' : editForm.role}
                                onChange={(e) => handleChangeField('role', e.target.value)}
                                style={{ fontSize: '13px' }}
                              >
                                {ROLE_OPTIONS_SEM_ADMIN.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )
                          ) : (
                            <span style={{ fontSize: '12px', fontWeight: '600' }}>{row.role || 'USER'}</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {isEditing ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                              <input
                                type="checkbox"
                                checked={editForm.is_active}
                                onChange={(e) => handleChangeField('is_active', e.target.checked)}
                              />
                              Ativo
                            </label>
                          ) : row.is_active === false ? (
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: 'rgba(239,68,68,0.16)',
                                color: '#ef4444',
                              }}
                            >
                              Desativado
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: 'rgba(34,197,94,0.16)',
                                color: '#22c55e',
                              }}
                            >
                              Ativo
                            </span>
                          )}
                        </td>
                        <td className="cell-assinatura">
                          <AssinaturaPagamentoCell
                            row={row}
                            isEditing={isEditing}
                            editForm={editForm}
                            onField={handleChangeField}
                          />
                        </td>
                        <td className="cell-acesso">
                          <UltimoAcessoCell row={row} getUserConnectionBadge={getUserConnectionBadge} />
                        </td>
                        <td className="cell-acoes">
                          <div className="admin-acoes-btns">
                            {isEditing ? (
                              <>
                                <button type="button" className="btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={handleSaveUser}>
                                  Salvar
                                </button>
                                <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={handleCancelEdit}>
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleEditUser(row)}>
                                Editar
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => handleResetPassword(row)}
                            >
                              Resetar senha
                            </button>
                            {!isPrincipal && (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.6)' }}
                                onClick={() => handleDeleteUser(row)}
                              >
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
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

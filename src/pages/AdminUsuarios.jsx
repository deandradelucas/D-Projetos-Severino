import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import './dashboard.css'

const ROLE_OPTIONS = [
  { value: 'USER', label: 'Usuário' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'READONLY', label: 'Somente leitura' },
]

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
      return <span style={{ ...baseStyle, backgroundColor: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>Nunca logou</span>
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
    <div className="dashboard-container">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="mobile-menu-btn" onClick={() => setMenuAberto(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
            </button>
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
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Telefone (WhatsApp)</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Último login</th>
                    <th>Conexão</th>
                    <th style={{ width: '170px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrarUsuarios().map((row) => {
                    const isEditing = editingUserId === row.id
                    return (
                      <tr key={row.id}>
                        <td>
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
                        <td>
                          {isEditing ? (
                            <input
                              type="email"
                              value={editForm.email}
                              onChange={(e) => handleChangeField('email', e.target.value)}
                              style={{ width: '100%', fontSize: '13px' }}
                            />
                          ) : (
                            row.email
                          )}
                        </td>
                        <td>
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
                            <select
                              value={editForm.role}
                              onChange={(e) => handleChangeField('role', e.target.value)}
                              style={{ fontSize: '13px' }}
                            >
                              {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontSize: '12px', fontWeight: '600' }}>{row.role || 'USER'}</span>
                          )}
                        </td>
                        <td>
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
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {row.last_login_at ? new Date(row.last_login_at).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td>{getUserConnectionBadge(row)}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
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
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.6)' }}
                              onClick={() => handleDeleteUser(row)}
                            >
                              Excluir
                            </button>
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

import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import { useTheme } from '../context/ThemeContext'

export default function Configuracoes() {
  const { theme, setTheme, privacyMode, togglePrivacy } = useTheme()
  const [menuAberto, setMenuAberto] = useState(false)

  const [perfil, setPerfil] = useState(() => {
    const saved = localStorage.getItem('horizonte_user')
    if (!saved) return { id: null, nome: 'Usuário', email: '', telefone: null, role: 'USER' }
    try {
      return JSON.parse(saved)
    } catch {
      return { id: null, nome: 'Usuário', email: '', telefone: null, role: 'USER' }
    }
  })

  const [emailDigest, setEmailDigest] = useState(() => localStorage.getItem('horizonte_email_digest') === 'true')
  const [toast, setToast] = useState('')
  const [exporting, setExporting] = useState(false)
  const [resetSending, setResetSending] = useState(false)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4200)
  }, [])

  useEffect(() => {
    if (!perfil?.id) return
    fetch('/api/usuarios/perfil', { headers: { 'x-user-id': perfil.id } })
      .then((res) => res.json())
      .then((data) => {
        if (data.perfil) {
          setPerfil((p) => ({
            ...p,
            ...data.perfil,
            nome: data.perfil.nome ?? p.nome,
            email: data.perfil.email ?? p.email,
            telefone: data.perfil.telefone ?? p.telefone,
            role: data.perfil.role ?? p.role,
          }))
          const u = { ...JSON.parse(localStorage.getItem('horizonte_user') || '{}'), ...data.perfil }
          localStorage.setItem('horizonte_user', JSON.stringify(u))
          window.dispatchEvent(new Event('horizonte-session-refresh'))
        }
      })
      .catch(() => {})
  }, [perfil?.id])

  useEffect(() => {
    localStorage.setItem('horizonte_email_digest', emailDigest ? 'true' : 'false')
  }, [emailDigest])

  const isAdmin = String(perfil.role || '').toUpperCase() === 'ADMIN'

  const copiarEmail = () => {
    if (!perfil.email) return
    navigator.clipboard.writeText(perfil.email).then(() => showToast('E-mail copiado.')).catch(() => {})
  }

  const solicitarRedefinicaoSenha = async () => {
    if (!perfil.email) return
    setResetSending(true)
    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: perfil.email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast(data.devResetUrl ? 'Link gerado (ambiente de desenvolvimento).' : 'Enviamos um link para seu e-mail.')
      } else {
        showToast(data.message || 'Não foi possível enviar o link.')
      }
    } catch {
      showToast('Erro de rede.')
    } finally {
      setResetSending(false)
    }
  }

  const exportarTransacoesJson = async () => {
    if (!perfil.id) return
    setExporting(true)
    try {
      const res = await fetch('/api/transacoes?limit=5000', { headers: { 'x-user-id': perfil.id } })
      if (!res.ok) throw new Error('Falha ao buscar transações.')
      const rows = await res.json()
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `horizonte-transacoes-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      showToast('Arquivo JSON baixado.')
    } catch (e) {
      showToast(e.message || 'Erro ao exportar.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="dashboard-container page-configuracoes app-horizon-shell">
      <div className="app-horizon-inner">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main config-page">
        <div className="ref-dashboard-inner">
        <header className="ref-dashboard-header">
          <MobileMenuButton onClick={() => setMenuAberto(true)} aria-label="Abrir menu" />
          <div className="ref-dashboard-header__lead">
            <h1 className="ref-dashboard-greeting">
              <span className="ref-dashboard-greeting__name">Configurações</span>
            </h1>
            <p className="ref-panel__subtitle page-configuracoes-header-sub">
              Perfil, privacidade e dados
            </p>
          </div>
        </header>

        {toast && <div className="config-toast">{toast}</div>}

        <div className="config-layout">
          <section className="config-card">
            <h2 className="config-card-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Seu perfil
            </h2>
            <div className="config-avatar-wrap">
              <div className="config-avatar" aria-hidden>
                {(perfil.nome || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {perfil.nome || 'Usuário'}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  {perfil.email || '—'}
                </p>
                {perfil.telefone ? (
                  <p className="config-meta">
                    Telefone (cadastro / WhatsApp):{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{perfil.telefone}</strong>
                    <br />
                    O bot usa <strong>só este número</strong> para vincular mensagens à sua conta.
                  </p>
                ) : (
                  <p className="config-meta">
                    Sem telefone no cadastro — o bot do WhatsApp não conseguirá associar mensagens a você até existir um número na conta.
                  </p>
                )}
              </div>
            </div>
            <div className="config-actions-row">
              <button type="button" className="config-btn-ghost" onClick={copiarEmail} disabled={!perfil.email}>
                Copiar e-mail
              </button>
              <button type="button" className="config-btn-ghost" onClick={solicitarRedefinicaoSenha} disabled={!perfil.email || resetSending}>
                {resetSending ? 'Enviando…' : 'Link para nova senha'}
              </button>
            </div>
          </section>

          <section className="config-card">
            <h2 className="config-card-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Preferências
            </h2>
            <div className="config-theme-picker-block">
              <div className="config-pref-label config-pref-label--block">
                <strong>Aparência</strong>
                <span>Escolha entre tema claro ou escuro. A preferência fica salva neste navegador.</span>
              </div>
              <div className="config-themes" role="group" aria-label="Tema da interface">
                <button
                  type="button"
                  className={`config-theme-card ${theme === 'light' ? 'is-active' : ''}`}
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  <div className="config-theme-preview config-theme-preview--light" aria-hidden />
                  <div className="config-theme-body">
                    <h4>Claro</h4>
                    <p>Mesmo layout, cores claras e fundo Horizonte.</p>
                  </div>
                </button>
                <button
                  type="button"
                  className={`config-theme-card ${theme === 'dark' ? 'is-active' : ''}`}
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <div className="config-theme-preview config-theme-preview--dark" aria-hidden />
                  <div className="config-theme-body">
                    <h4>Escuro</h4>
                    <p>Mesmo layout, paleta escura para ambientes com pouca luz.</p>
                  </div>
                </button>
              </div>
            </div>
            <div className="config-pref-row">
              <div className="config-pref-label">
                <strong>Modo privacidade</strong>
                <span>Oculta valores sensíveis nas telas principais</span>
              </div>
              <input type="checkbox" className="switch-apple" checked={privacyMode} onChange={togglePrivacy} aria-label="Modo privacidade" />
            </div>
            <div className="config-pref-row">
              <div className="config-pref-label">
                <strong>Resumo por e-mail</strong>
                <span>Preferência salva no navegador (integração de envio em evolução)</span>
              </div>
              <input
                type="checkbox"
                className="switch-apple"
                checked={emailDigest}
                onChange={() => setEmailDigest((v) => !v)}
                aria-label="Resumo por e-mail"
              />
            </div>
          </section>
        </div>

        <section className="config-card">
          <div className="config-section-label">Dados</div>
          <h2 className="config-card-title" style={{ marginTop: 0 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Exportar transações
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Baixe um arquivo JSON com até 5.000 lançamentos para backup ou análise externa.
          </p>
          <button type="button" className="btn-primary" style={{ padding: '10px 18px', fontSize: '14px' }} disabled={exporting || !perfil.id} onClick={exportarTransacoesJson}>
            {exporting ? 'Gerando…' : 'Baixar JSON'}
          </button>
        </section>

        {isAdmin && (
          <section className="config-card">
            <div className="config-section-label">Administração</div>
            <h2 className="config-card-title" style={{ marginTop: 0 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Painel admin
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Acesso a logs e usuários (conta com perfil administrador).
            </p>
            <div className="config-admin-strip">
              <Link className="config-btn-ghost" to="/admin/whatsapp" style={{ textDecoration: 'none' }} onClick={() => setMenuAberto(false)}>
                Logs WhatsApp
              </Link>
              <Link className="config-btn-ghost" to="/admin/usuarios" style={{ textDecoration: 'none' }} onClick={() => setMenuAberto(false)}>
                Logs usuários
              </Link>
              <Link className="config-btn-ghost" to="/admin/pagamentos" style={{ textDecoration: 'none' }} onClick={() => setMenuAberto(false)}>
                Logs de Pagamentos
              </Link>
            </div>
          </section>
        )}

        </div>
      </main>
      </div>
    </div>
  )
}

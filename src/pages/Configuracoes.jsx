import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { webAuthnSupported, registerWebAuthnCredential } from '../lib/webauthnBrowser'

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

  const [toast, setToast] = useState('')
  const [webauthnList, setWebauthnList] = useState([])
  const [webauthnLoading, setWebauthnLoading] = useState(false)
  const [webauthnError, setWebauthnError] = useState(null)
  const [bioRegistering, setBioRegistering] = useState(false)
  const [confirmBiometricRemoval, setConfirmBiometricRemoval] = useState(null)
  const usuarioIdHeader = String(perfil?.id ?? '').trim()

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4200)
  }, [])

  useEffect(() => {
    if (!usuarioIdHeader) return
    fetch('/api/usuarios/perfil', { headers: { 'x-user-id': usuarioIdHeader } })
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
  }, [usuarioIdHeader])

  const loadWebAuthn = useCallback(async () => {
    if (!usuarioIdHeader) return
    setWebauthnLoading(true)
    setWebauthnError(null)
    try {
      const res = await fetch(apiUrl('/api/auth/webauthn/credentials'), {
        headers: { 'x-user-id': usuarioIdHeader },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWebauthnList([])
        setWebauthnError(data.message || `Não foi possível carregar (${res.status}).`)
        return
      }
      setWebauthnList(Array.isArray(data.credentials) ? data.credentials : [])
    } catch {
      setWebauthnList([])
      setWebauthnError('Erro de rede ao carregar a biometria.')
    } finally {
      setWebauthnLoading(false)
    }
  }, [usuarioIdHeader])

  useEffect(() => {
    loadWebAuthn()
  }, [loadWebAuthn])

  const handleRegisterBiometric = async () => {
    if (!usuarioIdHeader) return
    if (!webAuthnSupported()) {
      showToast('Biometria requer HTTPS (ou localhost) e navegador compatível.')
      return
    }
    setBioRegistering(true)
    try {
      await registerWebAuthnCredential(() => ({ 'x-user-id': usuarioIdHeader }))
      showToast('Biometria ativada neste aparelho.')
      await loadWebAuthn()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível ativar a biometria.')
    } finally {
      setBioRegistering(false)
    }
  }

  const handleRemoveBiometric = async (credentialRowId) => {
    if (!usuarioIdHeader) return
    try {
      const res = await fetch(apiUrl(`/api/auth/webauthn/credentials/${credentialRowId}`), {
        method: 'DELETE',
        headers: { 'x-user-id': usuarioIdHeader },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Erro ao remover.')
      }
      showToast('Biometria removida.')
      await loadWebAuthn()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao remover.')
    }
  }

  const isAdmin = String(perfil.role || '').toUpperCase() === 'ADMIN'
  const biometricSupported = webAuthnSupported()
  const profileInitial = (perfil.nome || perfil.email || '?').charAt(0).toUpperCase()
  const roleLabel = isAdmin ? 'Administrador' : 'Usuário'
  const telefoneLabel = perfil.telefone || 'Não informado'

  const copiarEmail = () => {
    if (!perfil.email) return
    navigator.clipboard.writeText(perfil.email).then(() => showToast('E-mail copiado.')).catch(() => {})
  }

  return (
    <div className="dashboard-container page-configuracoes ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main config-page">
        <div className="ref-dashboard-inner dashboard-hub">
        <RefDashboardScroll>
        <section className="dashboard-hub__hero page-configuracoes__hero" aria-label="Configurações">
          <div className="dashboard-hub__hero-row">
            <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} aria-label="Abrir menu" />
            <div className="dashboard-hub__hero-text">
              <h1 className="dashboard-hub__title">Configurações</h1>
            </div>
          </div>
        </section>

        {toast && <div className="config-toast">{toast}</div>}

        <div className="config-layout config-layout--clean">
          <section className="config-card config-profile-card">
            <div className="config-profile-main">
              <div className="config-avatar config-avatar--clean" aria-hidden>
                {profileInitial}
              </div>
              <div className="config-profile-copy">
                <span className="config-card-kicker">Conta</span>
                <h2 className="config-profile-name">{perfil.nome || 'Usuário'}</h2>
                <p className="config-profile-email">{perfil.email || 'E-mail não informado'}</p>
              </div>
            </div>

            <div className="config-field-grid" aria-label="Dados do perfil">
              <div className="config-field">
                <span>Perfil</span>
                <strong>{roleLabel}</strong>
              </div>
              <div className="config-field">
                <span>Telefone</span>
                <strong>{telefoneLabel}</strong>
              </div>
            </div>

            <div className="config-quick-actions">
              <button type="button" className="config-action-btn" onClick={copiarEmail} disabled={!perfil.email}>
                Copiar e-mail
              </button>
            </div>
          </section>

          <section className="config-card">
            <div className="config-card-head">
              <span className="config-card-kicker">Preferências</span>
              <h2 className="config-card-title-clean">Aparência</h2>
              <p className="config-card-subtitle">Escolha o tema e o nível de privacidade da interface.</p>
            </div>

            <div className="config-themes config-themes--compact" role="group" aria-label="Tema da interface">
              <button
                type="button"
                className={`config-theme-card ${theme === 'light' ? 'is-active' : ''}`}
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
              >
                <div className="config-theme-preview config-theme-preview--light" aria-hidden />
                <div className="config-theme-body">
                  <h4>Claro</h4>
                  <p>Visual leve para o dia.</p>
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
                  <p>Menos brilho à noite.</p>
                </div>
              </button>
            </div>

            <div className="config-preference-list">
              <label className="config-pref-row config-pref-row--clean">
                <span className="config-pref-label">
                  <strong>Modo privacidade</strong>
                  <span>Oculta valores sensíveis nas telas principais.</span>
                </span>
                <input type="checkbox" className="switch-apple" checked={privacyMode} onChange={togglePrivacy} aria-label="Modo privacidade" />
              </label>
            </div>
          </section>

          <section className="config-card config-card--full config-security-card">
            <div className="config-card-head config-card-head--row">
              <div>
                <span className="config-card-kicker">Segurança</span>
                <h2 className="config-card-title-clean">Login por biometria</h2>
                <p className="config-card-subtitle">Use digital ou Face ID neste aparelho quando disponível.</p>
              </div>
              <button
                type="button"
                className="config-action-btn config-action-btn--primary"
                disabled={!usuarioIdHeader || bioRegistering || !biometricSupported}
                onClick={handleRegisterBiometric}
              >
                {bioRegistering ? 'Ativando…' : 'Ativar'}
              </button>
            </div>

            <div className="config-security-panel">
              {webauthnLoading ? (
                <p className="config-empty-note">Carregando dispositivos…</p>
              ) : webauthnError ? (
                <div className="config-empty-note">
                  <span>{webauthnError}</span>
                  <button type="button" className="config-action-btn" onClick={() => loadWebAuthn()}>
                    Tentar de novo
                  </button>
                </div>
              ) : webauthnList.length === 0 ? (
                <p className="config-empty-note">
                  Nenhuma biometria cadastrada nesta conta.
                </p>
              ) : (
                <ul className="config-bio-list">
                  {webauthnList.map((row) => (
                    <li key={row.id} className="config-bio-item">
                      <span>
                        <strong>
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                            : 'Dispositivo cadastrado'}
                        </strong>
                        {row.last_used_at ? (
                          <small>
                            Último uso: {new Date(row.last_used_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </small>
                        ) : null}
                      </span>
                      <button type="button" className="config-action-btn" onClick={() => setConfirmBiometricRemoval(row.id)}>
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {isAdmin && (
            <section className="config-card config-card--full config-admin-card">
              <div className="config-card-head">
                <span className="config-card-kicker">Administração</span>
                <h2 className="config-card-title-clean">Painel admin</h2>
              </div>
              <div className="config-admin-strip">
                <Link className="config-action-btn" to="/admin/usuarios" onClick={() => setMenuAberto(false)}>
                  Usuários
                </Link>
                <Link className="config-action-btn" to="/admin/pagamentos" onClick={() => setMenuAberto(false)}>
                  Pagamentos
                </Link>
              </div>
            </section>
          )}
        </div>

        </RefDashboardScroll>
        </div>
      </main>
      </div>
      <ConfirmDialog
        open={Boolean(confirmBiometricRemoval)}
        title="Remover biometria?"
        message="Este aparelho deixará de usar digital ou reconhecimento facial para entrar na conta."
        confirmLabel="Remover"
        onConfirm={() => handleRemoveBiometric(confirmBiometricRemoval)}
        onClose={() => setConfirmBiometricRemoval(null)}
      />
    </div>
  )
}

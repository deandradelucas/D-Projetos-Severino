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
  const [resetSending, setResetSending] = useState(false)
  const [webauthnList, setWebauthnList] = useState([])
  const [webauthnLoading, setWebauthnLoading] = useState(false)
  const [webauthnError, setWebauthnError] = useState(null)
  const [bioRegistering, setBioRegistering] = useState(false)
  const [confirmBiometricRemoval, setConfirmBiometricRemoval] = useState(null)
  const [familiaTitular, setFamiliaTitular] = useState(null)
  const [familiaMembros, setFamiliaMembros] = useState([])
  const [familiaConvites, setFamiliaConvites] = useState([])
  const [familiaLoadErr, setFamiliaLoadErr] = useState(null)
  const [familiaBusy, setFamiliaBusy] = useState(false)
  const [novoConvitePapel, setNovoConvitePapel] = useState('MEMBER')
  const [ultimoTokenConvite, setUltimoTokenConvite] = useState('')
  const [familiaConfirm, setFamiliaConfirm] = useState(null)
  const usuarioIdHeader = String(perfil?.id ?? '').trim()

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4200)
  }, [])

  const refreshAssinaturaPerfil = useCallback(async () => {
    if (!usuarioIdHeader) return
    try {
      const res = await fetch(apiUrl('/api/assinatura/status'), {
        headers: { 'x-user-id': usuarioIdHeader },
        cache: 'no-store',
      })
      if (!res.ok) return
      const assin = await res.json().catch(() => ({}))
      setPerfil((p) => ({ ...p, ...assin }))
      try {
        const raw = localStorage.getItem('horizonte_user')
        const u = { ...(raw ? JSON.parse(raw) : {}), ...assin }
        localStorage.setItem('horizonte_user', JSON.stringify(u))
        window.dispatchEvent(new Event('horizonte-session-refresh'))
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }, [usuarioIdHeader])

  const loadFamiliaPainel = useCallback(async () => {
    if (!usuarioIdHeader) return
    setFamiliaLoadErr(null)
    try {
      const resM = await fetch(apiUrl('/api/familia/membros'), { headers: { 'x-user-id': usuarioIdHeader } })
      if (resM.status === 403) {
        setFamiliaTitular(false)
        setFamiliaMembros([])
        setFamiliaConvites([])
        return
      }
      if (!resM.ok) {
        setFamiliaTitular(null)
        return
      }
      setFamiliaTitular(true)
      const m = await resM.json().catch(() => ({}))
      setFamiliaMembros(Array.isArray(m.membros) ? m.membros : [])
      const resC = await fetch(apiUrl('/api/familia/convites'), { headers: { 'x-user-id': usuarioIdHeader } })
      const c = resC.ok ? await resC.json().catch(() => ({})) : {}
      setFamiliaConvites(Array.isArray(c.convites) ? c.convites : [])
    } catch {
      setFamiliaLoadErr('Não foi possível carregar a conta familiar.')
    }
  }, [usuarioIdHeader])

  useEffect(() => {
    void refreshAssinaturaPerfil()
  }, [refreshAssinaturaPerfil])

  useEffect(() => {
    void loadFamiliaPainel()
  }, [loadFamiliaPainel])

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

  const copiarTexto = (t, okMsg = 'Copiado.') => {
    if (!t) return
    navigator.clipboard.writeText(t).then(() => showToast(okMsg)).catch(() => {})
  }

  const papelFamiliaLabel = (p) => {
    const x = String(p || '').toUpperCase()
    if (x === 'ADMIN') return 'Administrador familiar'
    if (x === 'VIEWER') return 'Só leitura'
    return 'Membro'
  }

  const loginConviteHref =
    typeof window !== 'undefined' && ultimoTokenConvite
      ? `${window.location.origin}/login?convite=${encodeURIComponent(ultimoTokenConvite)}`
      : ''

  const criarConviteFamilia = async () => {
    if (!usuarioIdHeader || familiaBusy) return
    setFamiliaBusy(true)
    try {
      const res = await fetch(apiUrl('/api/familia/convites'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': usuarioIdHeader },
        body: JSON.stringify({ papel: novoConvitePapel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.message || 'Não foi possível criar o convite.')
        return
      }
      setUltimoTokenConvite(String(data.token || '').trim())
      showToast(data.message || 'Convite criado.')
      await loadFamiliaPainel()
    } catch {
      showToast('Erro de rede ao criar convite.')
    } finally {
      setFamiliaBusy(false)
    }
  }

  const executarFamiliaConfirm = async () => {
    if (!familiaConfirm || !usuarioIdHeader) return
    setFamiliaBusy(true)
    try {
      if (familiaConfirm.type === 'revoke') {
        const res = await fetch(apiUrl(`/api/familia/convites/${familiaConfirm.id}`), {
          method: 'DELETE',
          headers: { 'x-user-id': usuarioIdHeader },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(data.message || 'Não foi possível revogar.')
          return
        }
        showToast(data.message || 'Convite revogado.')
        await loadFamiliaPainel()
      } else if (familiaConfirm.type === 'remove') {
        const res = await fetch(apiUrl(`/api/familia/membros/${familiaConfirm.usuarioId}`), {
          method: 'DELETE',
          headers: { 'x-user-id': usuarioIdHeader },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(data.message || 'Não foi possível remover.')
          return
        }
        showToast(data.message || 'Membro removido.')
        await loadFamiliaPainel()
      } else if (familiaConfirm.type === 'sair') {
        const res = await fetch(apiUrl('/api/familia/sair'), {
          method: 'POST',
          headers: { 'x-user-id': usuarioIdHeader },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(data.message || 'Não foi possível sair.')
          return
        }
        showToast(data.message || 'Você saiu da conta familiar.')
        await refreshAssinaturaPerfil()
        await loadFamiliaPainel()
      }
    } catch {
      showToast('Erro de rede.')
    } finally {
      setFamiliaBusy(false)
      setFamiliaConfirm(null)
    }
  }

  const solicitarCodigoSenhaWhatsapp = async () => {
    if (!perfil.email) return
    setResetSending(true)
    try {
      const res = await fetch(apiUrl('/api/auth/request-password-otp-whatsapp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: perfil.email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast(data.message || 'Se houver WhatsApp no cadastro, enviamos o código.')
      } else {
        showToast(data.message || 'Não foi possível enviar o código.')
      }
    } catch {
      showToast('Erro de rede.')
    } finally {
      setResetSending(false)
    }
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
              <button
                type="button"
                className="config-action-btn"
                onClick={() => void solicitarCodigoSenhaWhatsapp()}
                disabled={!perfil.email || resetSending}
                title="Envia um código de 6 dígitos para o WhatsApp cadastrado. Conclua a troca na tela de login em Esqueceu a senha."
              >
                {resetSending ? 'Enviando…' : 'Código no WhatsApp'}
              </button>
            </div>
          </section>

          {familiaTitular === true && (
            <section className="config-card config-card--full">
              <div className="config-card-head">
                <span className="config-card-kicker">Família</span>
                <h2 className="config-card-title-clean">Conta familiar</h2>
                <p className="config-card-subtitle">
                  Convites com link ou código curto, validade e revogação. Cada familiar usa login próprio; você define o papel (leitura ou lançamentos).
                </p>
              </div>

              {familiaLoadErr ? <p className="config-empty-note">{familiaLoadErr}</p> : null}

              <div className="config-field-grid" style={{ marginBottom: '1rem' }}>
                <label className="config-field" htmlFor="familia-papel-convite">
                  <span>Papel do próximo convite</span>
                  <select
                    id="familia-papel-convite"
                    className="config-action-btn"
                    style={{ width: '100%', cursor: 'pointer' }}
                    value={novoConvitePapel}
                    onChange={(e) => setNovoConvitePapel(e.target.value)}
                    disabled={familiaBusy}
                  >
                    <option value="MEMBER">Membro — pode lançar e editar (exceto pagamento do titular)</option>
                    <option value="VIEWER">Só leitura — não altera transações nem agenda</option>
                    <option value="ADMIN">Administrador familiar — mesmo nível de escrita que membro</option>
                  </select>
                </label>
              </div>

              <div className="config-quick-actions" style={{ marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className="config-action-btn config-action-btn--primary"
                  disabled={familiaBusy || !usuarioIdHeader}
                  onClick={() => void criarConviteFamilia()}
                >
                  {familiaBusy ? 'Gerando…' : 'Gerar convite'}
                </button>
              </div>

              {ultimoTokenConvite ? (
                <div className="config-security-panel" style={{ marginBottom: '1.25rem' }}>
                  <p className="config-card-subtitle" style={{ marginBottom: '0.5rem' }}>
                    <strong>Guarde agora:</strong> o código só aparece uma vez. Quem receber deve abrir o link ou colar o código após criar conta / login.
                  </p>
                  <div
                    className="config-field"
                    style={{
                      wordBreak: 'break-all',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.85rem',
                      padding: '0.75rem',
                      borderRadius: '12px',
                      background: 'color-mix(in srgb, var(--color-neutral-500, #737373) 8%, transparent)',
                    }}
                  >
                    {ultimoTokenConvite}
                  </div>
                  <div className="config-quick-actions" style={{ marginTop: '0.75rem' }}>
                    <button type="button" className="config-action-btn" onClick={() => copiarTexto(ultimoTokenConvite, 'Código copiado.')}>
                      Copiar código
                    </button>
                    {loginConviteHref ? (
                      <button type="button" className="config-action-btn" onClick={() => copiarTexto(loginConviteHref, 'Link copiado.')}>
                        Copiar link
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="config-card-head" style={{ marginTop: '0.5rem' }}>
                <h3 className="config-card-title-clean" style={{ fontSize: '1rem' }}>
                  Convites pendentes
                </h3>
              </div>
              {familiaConvites.length === 0 ? (
                <p className="config-empty-note">Nenhum convite ativo.</p>
              ) : (
                <ul className="config-bio-list">
                  {familiaConvites.map((c) => (
                    <li key={c.id} className="config-bio-item">
                      <span>
                        <strong>{papelFamiliaLabel(c.papel_convite)}</strong>
                        <small>
                          Expira em{' '}
                          {c.expires_at
                            ? new Date(c.expires_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </small>
                      </span>
                      <button type="button" className="config-action-btn" onClick={() => setFamiliaConfirm({ type: 'revoke', id: c.id })}>
                        Revogar
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="config-card-head" style={{ marginTop: '1rem' }}>
                <h3 className="config-card-title-clean" style={{ fontSize: '1rem' }}>
                  Membros
                </h3>
              </div>
              {familiaMembros.length === 0 ? (
                <p className="config-empty-note">Nenhum familiar vinculado ainda.</p>
              ) : (
                <ul className="config-bio-list">
                  {familiaMembros.map((mem) => (
                    <li key={mem.id} className="config-bio-item">
                      <span>
                        <strong>{mem.nome || mem.email || mem.id}</strong>
                        <small>
                          {mem.email ? `${mem.email} · ` : ''}
                          {papelFamiliaLabel(mem.familia_papel)}
                        </small>
                      </span>
                      <button type="button" className="config-action-btn" onClick={() => setFamiliaConfirm({ type: 'remove', usuarioId: mem.id })}>
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {familiaTitular === false && perfil.conta_familiar_membro ? (
            <section className="config-card config-card--full">
              <div className="config-card-head">
                <span className="config-card-kicker">Família</span>
                <h2 className="config-card-title-clean">Conta vinculada</h2>
                <p className="config-card-subtitle">
                  Você acessa os dados da conta do titular com seu próprio login. Papel:{' '}
                  <strong>{papelFamiliaLabel(perfil.familia_papel)}</strong>.
                  {String(perfil.familia_papel || '').toUpperCase() === 'VIEWER'
                    ? ' Alterações em transações e agenda não são permitidas.'
                    : null}
                </p>
              </div>
              <button
                type="button"
                className="config-action-btn"
                disabled={familiaBusy}
                onClick={() => setFamiliaConfirm({ type: 'sair' })}
              >
                Sair da conta familiar
              </button>
            </section>
          ) : null}

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
                <Link className="config-action-btn" to="/admin/auditoria" onClick={() => setMenuAberto(false)}>
                  Auditoria
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
      <ConfirmDialog
        open={Boolean(familiaConfirm)}
        title={
          familiaConfirm?.type === 'revoke'
            ? 'Revogar convite?'
            : familiaConfirm?.type === 'remove'
              ? 'Remover familiar?'
              : 'Sair da conta familiar?'
        }
        message={
          familiaConfirm?.type === 'revoke'
            ? 'O link e o código deste convite deixarão de funcionar.'
            : familiaConfirm?.type === 'remove'
              ? 'O familiar voltará a ver apenas os dados da própria conta.'
              : 'Você deixa de acessar os dados do titular; sua conta e seus próprios dados permanecem.'
        }
        confirmLabel={familiaConfirm?.type === 'sair' ? 'Sair' : 'Confirmar'}
        onConfirm={() => void executarFamiliaConfirm()}
        onClose={() => setFamiliaConfirm(null)}
      />
    </div>
  )
}

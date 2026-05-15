import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import ConfirmDialog from '../components/ConfirmDialog'
import ConfigSelectCustom from '../components/ConfigSelectCustom.jsx'
import FamiliaConviteColarBlock from '../components/FamiliaConviteColarBlock'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { montarTextoConviteFamiliaComPwa } from '../lib/familiaConviteMensagemCompartilhavel'
import { getPublicAppOriginForConvites } from '../lib/publicAppOrigin'
import { webAuthnSupported, registerWebAuthnCredential } from '../lib/webauthnBrowser'
import { formatPhoneBRDisplay, maskPhoneBRMobile, validatePhoneBRMobile } from '../lib/formatPhoneBR'

const PAPEL_CONVITE_OPCOES = [
  { value: 'MEMBER', label: 'Membro — pode lançar e editar (exceto pagamento do titular)' },
  { value: 'VIEWER', label: 'Só leitura — não altera transações nem agenda' },
  { value: 'ADMIN', label: 'Administrador familiar — mesmo nível de escrita que membro' },
]

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
  const [novoConviteLabel, setNovoConviteLabel] = useState('')
  const [ultimoTokenConvite, setUltimoTokenConvite] = useState('')
  const [familiaConfirm, setFamiliaConfirm] = useState(null)
  const [alterarPapelMembro, setAlterarPapelMembro] = useState(null)
  const [familiaPainelCarregado, setFamiliaPainelCarregado] = useState(false)
  const [telefoneEditando, setTelefoneEditando] = useState(false)
  const [telefoneInput, setTelefoneInput] = useState('')
  const [telefoneSaving, setTelefoneSaving] = useState(false)
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
    if (!usuarioIdHeader) {
      setFamiliaPainelCarregado(false)
      return
    }
    /* Convidadas/os (qualquer papel) não gerem família na UI — não pedir painel ao servidor */
    if (perfil?.conta_familiar_membro === true) {
      setFamiliaTitular(false)
      setFamiliaMembros([])
      setFamiliaConvites([])
      setFamiliaLoadErr(null)
      setFamiliaPainelCarregado(true)
      return
    }
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
    } finally {
      setFamiliaPainelCarregado(true)
    }
  }, [usuarioIdHeader, perfil?.conta_familiar_membro])

  useEffect(() => {
    void refreshAssinaturaPerfil()
  }, [refreshAssinaturaPerfil])

  useEffect(() => {
    void loadFamiliaPainel()
  }, [loadFamiliaPainel])

  useEffect(() => {
    if (!usuarioIdHeader) return
    fetch(apiUrl('/api/usuarios/perfil'), { headers: { 'x-user-id': usuarioIdHeader } })
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
          /* Perfil pode chegar antes da assinatura — repete status para preencher conta_familiar_titular_nome */
          void refreshAssinaturaPerfil()
        }
      })
      .catch(() => {})
  }, [usuarioIdHeader, refreshAssinaturaPerfil])

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
  const telefoneLabel = perfil.telefone ? formatPhoneBRDisplay(perfil.telefone) : 'Não informado'

  const abrirEditarTelefone = () => {
    setTelefoneInput(maskPhoneBRMobile(perfil.telefone || ''))
    setTelefoneEditando(true)
  }

  const cancelarEditarTelefone = () => {
    setTelefoneEditando(false)
    setTelefoneInput('')
  }

  const salvarTelefone = async () => {
    if (!usuarioIdHeader || telefoneSaving) return
    const check = validatePhoneBRMobile(telefoneInput)
    if (!check.ok) {
      showToast(check.message)
      return
    }
    setTelefoneSaving(true)
    try {
      const res = await fetch(apiUrl('/api/usuarios/perfil/telefone'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': usuarioIdHeader },
        body: JSON.stringify({ telefone: check.digits }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.message || 'Não foi possível atualizar o telefone.')
        return
      }
      const nextTelefone = data.perfil?.telefone ?? check.digits
      setPerfil((p) => ({ ...p, telefone: nextTelefone }))
      try {
        const raw = localStorage.getItem('horizonte_user')
        const u = { ...(raw ? JSON.parse(raw) : {}), telefone: nextTelefone }
        localStorage.setItem('horizonte_user', JSON.stringify(u))
        window.dispatchEvent(new Event('horizonte-session-refresh'))
      } catch {
        /* ignore */
      }
      setTelefoneEditando(false)
      setTelefoneInput('')
      showToast(data.message || 'Telefone atualizado.')
    } catch {
      showToast('Erro de rede ao salvar telefone.')
    } finally {
      setTelefoneSaving(false)
    }
  }

  const copiarEmail = () => {
    if (!perfil.email) return
    navigator.clipboard.writeText(perfil.email).then(() => showToast('E-mail copiado.')).catch(() => {})
  }

  const mostrarCampoConviteFamilia =
    Boolean(usuarioIdHeader) && familiaPainelCarregado && !perfil.conta_familiar_membro

  const podeColarConviteFamilia = mostrarCampoConviteFamilia

  const irParaCodigoConviteFamilia = () => {
    document.getElementById('config-secao-convite-familia')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => {
      document.getElementById('config-familia-convite-textarea')?.focus()
    }, 380)
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

  /** Alinhado ao servidor: 5 pessoas no total = titular + até 4 (membros + convites pendentes válidos). */
  const FAMILIA_MAX_VINCULADOS_UI = 4
  const familiaVagasOcupadas = familiaMembros.length + familiaConvites.length
  const familiaLimiteConvitesAtingido = familiaVagasOcupadas >= FAMILIA_MAX_VINCULADOS_UI

  const convitePublicOrigin = useMemo(() => getPublicAppOriginForConvites(), [])

  const loginConviteHref =
    typeof window !== 'undefined' && ultimoTokenConvite
      ? `${convitePublicOrigin}/login?convite=${encodeURIComponent(ultimoTokenConvite)}`
      : ''

  const textoConviteCompletoComPwa = useMemo(() => {
    if (!ultimoTokenConvite || typeof window === 'undefined') return ''
    return montarTextoConviteFamiliaComPwa({
      baseUrl: convitePublicOrigin,
      token: ultimoTokenConvite,
      titularNome: perfil?.nome,
    })
  }, [ultimoTokenConvite, perfil?.nome, convitePublicOrigin])

  const criarConviteFamilia = async () => {
    if (!usuarioIdHeader || familiaBusy) return
    setFamiliaBusy(true)
    try {
      const res = await fetch(apiUrl('/api/familia/convites'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': usuarioIdHeader },
        body: JSON.stringify({ papel: novoConvitePapel, label: novoConviteLabel.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.message || 'Não foi possível criar o convite.')
        return
      }
      setUltimoTokenConvite(String(data.token || '').trim())
      setNovoConviteLabel('')
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
          showToast(data.message || 'Não foi possível remover o convite.')
          return
        }
        showToast(data.message || 'Convite removido.')
        await loadFamiliaPainel()
      } else if (familiaConfirm.type === 'revoke_all') {
        const ids = familiaConvites.map((c) => c.id).filter(Boolean)
        const results = await Promise.all(
          ids.map((id) =>
            fetch(apiUrl(`/api/familia/convites/${id}`), {
              method: 'DELETE',
              headers: { 'x-user-id': usuarioIdHeader },
            }).then((r) => r.ok)
          )
        )
        const ok = results.filter(Boolean).length
        const fail = results.length - ok
        if (fail === 0) {
          showToast(ok === 1 ? 'Convite pendente removido.' : `${ok} convites pendentes removidos.`)
        } else {
          showToast(
            ok > 0
              ? `Removidos ${ok} convite(s); ${fail} falharam. Atualize a lista e tente de novo.`
              : 'Não foi possível remover os convites. Tente de novo.',
          )
        }
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

  const executarAlterarPapel = async (membroId, novoPapel) => {
    if (!usuarioIdHeader || familiaBusy) return
    setFamiliaBusy(true)
    try {
      const res = await fetch(apiUrl(`/api/familia/membros/${membroId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': usuarioIdHeader },
        body: JSON.stringify({ papel: novoPapel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(data.message || 'Não foi possível alterar o papel.'); return }
      showToast(data.message || 'Papel atualizado.')
      setAlterarPapelMembro(null)
      await loadFamiliaPainel()
    } catch { showToast('Erro de rede.') }
    finally { setFamiliaBusy(false) }
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
        <section className="dashboard-hub__hero page-configuracoes__hero" aria-label="Ajustes">
          <div className="dashboard-hub__hero-row">
            <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} aria-label="Abrir menu" />
            <div className="dashboard-hub__hero-text">
              <h1 className="dashboard-hub__title">Ajustes</h1>
            </div>
          </div>
        </section>

        {toast ? (
          <div className="config-toast" role="status" aria-live="polite">
            {toast}
          </div>
        ) : null}

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

            {perfil.conta_familiar_membro ? (
              <div className="config-membro-familia-row">
                <p className="config-membro-familia-text">
                  Membro Familiar de:{' '}
                  <strong className="config-membro-familia-nome">
                    {String(perfil.conta_familiar_titular_nome || '').trim() || 'Titular'}
                  </strong>
                </p>
                <button
                  type="button"
                  className="config-action-btn config-membro-familia-sair"
                  disabled={familiaBusy}
                  onClick={() => setFamiliaConfirm({ type: 'sair' })}
                >
                  Sair
                </button>
              </div>
            ) : null}

            {telefoneEditando ? (
              <div className="config-telefone-form" aria-label="Alterar telefone">
                <label className="config-field config-field--stretch" htmlFor="config-telefone-input">
                  <span>Celular (WhatsApp)</span>
                  <input
                    id="config-telefone-input"
                    type="tel"
                    className="config-input"
                    value={telefoneInput}
                    onChange={(e) => setTelefoneInput(maskPhoneBRMobile(e.target.value))}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    autoComplete="tel"
                    inputMode="numeric"
                    disabled={telefoneSaving}
                  />
                </label>
                <p className="config-telefone-form__hint">
                  Usado para recuperar senha via WhatsApp e para o assistente no celular.
                </p>
                <div className="config-telefone-form__actions">
                  <button
                    type="button"
                    className="config-action-btn config-action-btn--primary"
                    disabled={telefoneSaving}
                    onClick={() => void salvarTelefone()}
                  >
                    {telefoneSaving ? 'Salvando…' : 'Salvar telefone'}
                  </button>
                  <button
                    type="button"
                    className="config-action-btn"
                    disabled={telefoneSaving}
                    onClick={cancelarEditarTelefone}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            <div className="config-quick-actions">
              <button type="button" className="config-action-btn" onClick={copiarEmail} disabled={!perfil.email}>
                Copiar e-mail
              </button>
              <button type="button" className="config-action-btn" onClick={abrirEditarTelefone} disabled={!usuarioIdHeader}>
                {perfil.telefone ? 'Alterar telefone' : 'Cadastrar telefone'}
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
              {podeColarConviteFamilia ? (
                <button
                  type="button"
                  className="config-action-btn"
                  onClick={irParaCodigoConviteFamilia}
                  title="Abre o campo para colar o código ou o link do convite"
                >
                  Código de convite familiar
                </button>
              ) : null}
            </div>

            {mostrarCampoConviteFamilia ? (
              <div id="config-secao-convite-familia" className="config-familia-no-perfil">
                <div className="config-card-head">
                  <span className="config-card-kicker">Família</span>
                  <h3 className="config-subsection__title">Código de convite familiar</h3>
                  <p className="config-card-subtitle">
                    Use o campo abaixo para colar o <strong>código</strong> ou o <strong>link</strong> enviado pelo titular.
                  </p>
                </div>
                <FamiliaConviteColarBlock
                  idPrefix="config-familia-convite"
                  usuarioIdParaAceitar={usuarioIdHeader}
                  visualVariant="shell"
                  onAceitarSucesso={(data) => {
                    showToast(data?.message || 'Convite familiar aceito.')
                    void refreshAssinaturaPerfil()
                    void loadFamiliaPainel()
                  }}
                  onAceitarErro={(msg) => showToast(msg)}
                />
              </div>
            ) : null}
          </section>

          <section className="config-card config-card--preferences" aria-labelledby="config-preferencias-heading">
            <div className="config-card-head">
              <span className="config-card-kicker">Preferências</span>
              <h2 id="config-preferencias-heading" className="config-card-title-clean">
                Aparência
              </h2>
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

          {familiaTitular === true && (
            <section className="config-card config-card--full">
              <div className="config-card-head">
                <span className="config-card-kicker">Família</span>
                <h2 className="config-card-title-clean">Conta familiar</h2>
                <p className="config-card-subtitle">
                  Convites com link ou código curto, validade e revogação. Cada familiar usa login próprio para ver e lançar dados; só o <strong>titular</strong> gere convites e membros aqui — quem foi convidado não altera estas definições.{' '}
                  <strong>Limite:</strong> 5 pessoas no total (titular + até 4 vinculados). Convites pendentes ocupam vaga até aceitos, expirarem ou serem removidos.
                </p>
              </div>

              {familiaLoadErr ? <p className="config-empty-note">{familiaLoadErr}</p> : null}

              <p className="config-card-subtitle config-familia-vagas-line">
                {familiaVagasOcupadas === 0
                  ? 'Nenhum familiar vinculado ainda.'
                  : `${familiaVagasOcupadas} de ${FAMILIA_MAX_VINCULADOS_UI} vaga${familiaVagasOcupadas !== 1 ? 's' : ''} usada${familiaVagasOcupadas !== 1 ? 's' : ''} (membros + convites pendentes).`}
              </p>

              <div className="config-familia-generate-row">
                <label className="config-field config-field--stretch" htmlFor="familia-papel-convite">
                  <span>Papel do próximo convite</span>
                  <ConfigSelectCustom
                    id="familia-papel-convite"
                    value={novoConvitePapel}
                    onChange={setNovoConvitePapel}
                    options={PAPEL_CONVITE_OPCOES}
                    disabled={familiaBusy}
                  />
                </label>
                <div className="config-field config-field--stretch">
                  <label htmlFor="familia-convite-label" className="config-field-label">
                    <span>Identificação (opcional)</span>
                  </label>
                  <input
                    id="familia-convite-label"
                    type="text"
                    className="config-input"
                    placeholder='Ex: "Para João" — aparece na lista de pendentes'
                    maxLength={60}
                    value={novoConviteLabel}
                    onChange={(e) => setNovoConviteLabel(e.target.value)}
                    disabled={familiaBusy || familiaLimiteConvitesAtingido}
                  />
                </div>
                <div className="config-familia-generate-row__cta">
                  <button
                    type="button"
                    className="config-action-btn config-action-btn--primary"
                    disabled={familiaBusy || !usuarioIdHeader || familiaLimiteConvitesAtingido}
                    onClick={() => void criarConviteFamilia()}
                  >
                    {familiaBusy ? 'Gerando…' : 'Gerar convite'}
                  </button>
                </div>
              </div>

              {familiaLimiteConvitesAtingido ? (
                <p className="config-empty-note config-familia-limite-note">
                  Limite de <strong>5 pessoas</strong> atingido ({familiaVagasOcupadas} vaga(s) em uso entre membros e convites pendentes). Remova um convite
                  pendente ou um membro para poder gerar outro convite.
                </p>
              ) : null}

              {ultimoTokenConvite ? (
                <div className="config-invite-panel">
                  <p className="config-card-subtitle config-invite-panel__lead">
                    <strong>Guarde agora:</strong> o código só aparece uma vez. Quem receber pode usar o link, colar o código no cadastro ou, já com conta, em{' '}
                    <strong>Ajustes → Código de convite familiar</strong>. Envie a mensagem abaixo por WhatsApp ou e-mail — inclui o link, o código e como instalar o app na tela inicial.
                  </p>
                  <div className="config-invite-token" aria-label="Código do convite">
                    {ultimoTokenConvite}
                  </div>
                  <div className="config-invite-actions">
                    <button type="button" className="config-action-btn" onClick={() => copiarTexto(ultimoTokenConvite, 'Código copiado.')}>
                      Copiar código
                    </button>
                    {loginConviteHref ? (
                      <button type="button" className="config-action-btn" onClick={() => copiarTexto(loginConviteHref, 'Link copiado.')}>
                        Copiar link
                      </button>
                    ) : null}
                    {textoConviteCompletoComPwa ? (
                      <button
                        type="button"
                        className="config-action-btn"
                        onClick={() => copiarTexto(textoConviteCompletoComPwa, 'Mensagem copiada — cole no WhatsApp ou no e-mail.')}
                      >
                        Copiar mensagem completa
                      </button>
                    ) : null}
                  </div>
                  {textoConviteCompletoComPwa ? (
                    <div className="config-invite-preview-field">
                      <span id="config-familia-convite-mensagem-pwa-label">Pré-visualização da mensagem</span>
                      <textarea
                        id="config-familia-convite-mensagem-pwa"
                        readOnly
                        rows={14}
                        value={textoConviteCompletoComPwa}
                        className="config-invite-message-preview"
                        aria-labelledby="config-familia-convite-mensagem-pwa-label"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="config-subsection config-subsection--flush-top">
                <div className="config-subsection__head">
                  <h3 className="config-subsection__title">Convites pendentes</h3>
                  {familiaConvites.length > 0 ? (
                    <button
                      type="button"
                      className="config-action-btn"
                      disabled={familiaBusy}
                      onClick={() => setFamiliaConfirm({ type: 'revoke_all' })}
                    >
                      Remover todos
                    </button>
                  ) : null}
                </div>
              {familiaConvites.length === 0 ? (
                <p className="config-empty-note">Nenhum convite ativo.</p>
              ) : (
                <ul className="config-bio-list">
                  {familiaConvites.map((c) => (
                    <li key={c.id} className="config-bio-item">
                      <span>
                        <strong>{papelFamiliaLabel(c.papel_convite)}</strong>
                        {c.label ? <em className="config-bio-item__tag"> · {c.label}</em> : null}
                        <small>
                          Expira em{' '}
                          {c.expires_at
                            ? new Date(c.expires_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </small>
                      </span>
                      <button type="button" className="config-action-btn" onClick={() => setFamiliaConfirm({ type: 'revoke', id: c.id })}>
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              </div>

              <div className="config-subsection">
                <h3 className="config-subsection__title">Membros</h3>
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
                      <div className="config-bio-item__actions">
                        {alterarPapelMembro?.usuarioId === mem.id ? (
                          <>
                            <select
                              className="config-input config-input--compact"
                              value={alterarPapelMembro.novoPapel}
                              disabled={familiaBusy}
                              onChange={(e) => setAlterarPapelMembro((prev) => ({ ...prev, novoPapel: e.target.value }))}
                            >
                              {PAPEL_CONVITE_OPCOES.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="config-action-btn config-action-btn--primary"
                              disabled={familiaBusy || alterarPapelMembro.novoPapel === mem.familia_papel}
                              onClick={() => void executarAlterarPapel(mem.id, alterarPapelMembro.novoPapel)}
                            >
                              {familiaBusy ? 'Salvando…' : 'Salvar'}
                            </button>
                            <button
                              type="button"
                              className="config-action-btn"
                              onClick={() => setAlterarPapelMembro(null)}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="config-action-btn"
                              disabled={familiaBusy}
                              onClick={() => setAlterarPapelMembro({ usuarioId: mem.id, novoPapel: mem.familia_papel })}
                            >
                              Alterar papel
                            </button>
                            <button
                              type="button"
                              className="config-action-btn"
                              onClick={() => setFamiliaConfirm({ type: 'remove', usuarioId: mem.id })}
                            >
                              Remover
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </section>
          )}

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
            ? 'Remover convite pendente?'
            : familiaConfirm?.type === 'revoke_all'
              ? 'Remover todos os convites pendentes?'
              : familiaConfirm?.type === 'remove'
                ? 'Remover familiar?'
                : 'Sair da conta familiar?'
        }
        message={
          familiaConfirm?.type === 'revoke'
            ? 'O link e o código deste convite deixarão de funcionar.'
            : familiaConfirm?.type === 'revoke_all'
              ? 'Todos os links e códigos destes convites deixarão de funcionar. Membros já vinculados não são afetados.'
              : familiaConfirm?.type === 'remove'
                ? 'O familiar voltará a ver apenas os dados da própria conta.'
                : 'Você deixa de acessar os dados do titular; sua conta e seus próprios dados permanecem.'
        }
        confirmLabel={
          familiaConfirm?.type === 'sair' ? 'Sair' : familiaConfirm?.type === 'revoke_all' ? 'Remover todos' : 'Remover'
        }
        onConfirm={() => void executarFamiliaConfirm()}
        onClose={() => setFamiliaConfirm(null)}
      />
    </div>
  )
}

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import ConfirmDialog from '../components/ConfirmDialog'
import ConfigSelectCustom from '../components/ConfigSelectCustom.jsx'
import FamiliaConviteColarBlock from '../components/FamiliaConviteColarBlock'
import ConfigAparenciaCard from '../components/configuracoes/ConfigAparenciaCard'
import ConfigBiometriaCard from '../components/configuracoes/ConfigBiometriaCard'
import { useTheme } from '../context/ThemeContext'
import { useConfigWebAuthn } from '../hooks/useConfigWebAuthn'
import { apiUrl } from '../lib/apiUrl'
import { horizonteApiAuthHeaders } from '../lib/apiAuthHeaders'
import { montarTextoConviteFamiliaComPwa } from '../lib/familiaConviteMensagemCompartilhavel'
import { getPublicAppOriginForConvites } from '../lib/publicAppOrigin'
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
  const [familiaTitular, setFamiliaTitular] = useState(null)
  const [familiaMembros, setFamiliaMembros] = useState([])
  const [familiaConvites, setFamiliaConvites] = useState([])
  const [familiaLoadErr, setFamiliaLoadErr] = useState(null)
  const [familiaBusy, setFamiliaBusy] = useState(false)
  const [novoConvitePapel, setNovoConvitePapel] = useState('MEMBER')
  const [ultimoTokenConvite, setUltimoTokenConvite] = useState('')
  const [conviteCopiadoVisivel, setConviteCopiadoVisivel] = useState(false)
  const conviteCopiadoTimerRef = useRef(null)
  const [familiaConfirm, setFamiliaConfirm] = useState(null)
  const [alterarPapelMembro, setAlterarPapelMembro] = useState(null)
  const [, setFamiliaPainelCarregado] = useState(false)
  const [telefoneEditando, setTelefoneEditando] = useState(false)
  const [telefoneInput, setTelefoneInput] = useState('')
  const [telefoneSaving, setTelefoneSaving] = useState(false)
  const usuarioIdHeader = String(perfil?.id ?? '').trim()

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4200)
  }, [])

  const {
    webauthnList,
    webauthnLoading,
    webauthnError,
    bioRegistering,
    confirmBiometricRemoval,
    setConfirmBiometricRemoval,
    handleRegisterBiometric,
    handleRemoveBiometric,
    loadWebAuthn,
  } = useConfigWebAuthn({ usuarioIdHeader, showToast })

  const refreshAssinaturaPerfil = useCallback(async () => {
    if (!usuarioIdHeader) return
    try {
      const res = await fetch(apiUrl('/api/assinatura/status'), {
        headers: horizonteApiAuthHeaders(),
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
      const resM = await fetch(apiUrl('/api/familia/membros'), { headers: horizonteApiAuthHeaders() })
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
      const resC = await fetch(apiUrl('/api/familia/convites'), { headers: horizonteApiAuthHeaders() })
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
    fetch(apiUrl('/api/usuarios/perfil'), { headers: horizonteApiAuthHeaders() })
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

  const isAdmin = String(perfil.role || '').toUpperCase() === 'ADMIN'
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
        headers: horizonteApiAuthHeaders({ 'Content-Type': 'application/json' }),
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

  const copiarConviteFamilia = useCallback((texto) => {
    if (!texto) return
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setConviteCopiadoVisivel(true)
        if (conviteCopiadoTimerRef.current) window.clearTimeout(conviteCopiadoTimerRef.current)
        conviteCopiadoTimerRef.current = window.setTimeout(() => setConviteCopiadoVisivel(false), 2800)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      if (conviteCopiadoTimerRef.current) window.clearTimeout(conviteCopiadoTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setConviteCopiadoVisivel(false)
  }, [ultimoTokenConvite])

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
        headers: horizonteApiAuthHeaders({ 'Content-Type': 'application/json' }),
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
          headers: horizonteApiAuthHeaders(),
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
              headers: horizonteApiAuthHeaders(),
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
          headers: horizonteApiAuthHeaders(),
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
          headers: horizonteApiAuthHeaders(),
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
        headers: horizonteApiAuthHeaders({ 'Content-Type': 'application/json' }),
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
              <div className="config-profile-copy">
                <span className="config-card-kicker">Conta</span>
                <h2 className="config-profile-name">{perfil.nome || 'Usuário'}</h2>
                <p className="config-profile-email">{perfil.email || 'E-mail não informado'}</p>
              </div>
            </div>

            <div className="config-field-grid config-field-grid--single" aria-label="Dados do perfil">
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
                  Usado pelo assistente no WhatsApp. Para trocar a senha, use Esqueceu a senha? na tela de login.
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
              <button type="button" className="config-action-btn" onClick={abrirEditarTelefone} disabled={!usuarioIdHeader}>
                {perfil.telefone ? 'Alterar telefone' : 'Cadastrar telefone'}
              </button>
            </div>
          </section>

          <ConfigAparenciaCard
            theme={theme}
            setTheme={setTheme}
            privacyMode={privacyMode}
            togglePrivacy={togglePrivacy}
          />

          <div className="config-familia-group config-layout__full-span">
            {Boolean(usuarioIdHeader) && !perfil.conta_familiar_membro && familiaTitular !== true ? (
              <section className="config-card config-card--full" id="config-secao-convite-familia">
                <div className="config-card-head">
                  <span className="config-card-kicker">Família</span>
                  <h2 className="config-card-title-clean">Código de convite familiar</h2>
                  <p className="config-card-subtitle config-familia-intro">
                    Cole o <strong>link</strong> ou o <strong>código</strong> que o titular enviou. Quando aparecer convite válido, toque em{' '}
                    <strong>Vincular à esta conta</strong>.
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
              </section>
            ) : null}

            {familiaTitular === true ? (
            <section className="config-card config-card--full config-familia-titular-card">
              <div className="config-card-head">
                <span className="config-card-kicker">Família</span>
                <h2 className="config-card-title-clean">Conta familiar</h2>
                <p className="config-card-subtitle config-familia-intro">
                  Convide por link ou código. Cada familiar com login próprio; só o <strong>titular</strong> gere convites e membros aqui.{' '}
                  <strong>Até 5</strong> (titular + 4) — pendentes contam na vaga até aceitar ou expirar.
                </p>
              </div>

              {!perfil.conta_familiar_membro ? (
                <div className="config-subsection config-familia-convite-interno" id="config-secao-convite-familia">
                  <h3 className="config-subsection__title">Código de convite familiar</h3>
                  <p className="config-card-subtitle config-familia-intro">
                    Recebeu convite de outra família? Cole o <strong>link</strong> ou o <strong>código</strong> e confirme em{' '}
                    <strong>Vincular à esta conta</strong>.
                  </p>
                  <FamiliaConviteColarBlock
                    idPrefix="config-familia-convite-titular"
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
                    <button type="button" className="config-action-btn" onClick={() => copiarConviteFamilia(ultimoTokenConvite)}>
                      Copiar código
                    </button>
                    {loginConviteHref ? (
                      <button type="button" className="config-action-btn" onClick={() => copiarConviteFamilia(loginConviteHref)}>
                        Copiar link
                      </button>
                    ) : null}
                    {textoConviteCompletoComPwa ? (
                      <button
                        type="button"
                        className="config-action-btn"
                        onClick={() => copiarConviteFamilia(textoConviteCompletoComPwa)}
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
                  <p
                    className={`config-invite-copiado${conviteCopiadoVisivel ? ' config-invite-copiado--visible' : ''}`}
                    role="status"
                    aria-live="polite"
                  >
                    Copiado
                  </p>
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
            ) : null}
          </div>

          <ConfigBiometriaCard
            usuarioIdHeader={usuarioIdHeader}
            webauthnList={webauthnList}
            webauthnLoading={webauthnLoading}
            webauthnError={webauthnError}
            bioRegistering={bioRegistering}
            handleRegisterBiometric={handleRegisterBiometric}
            setConfirmBiometricRemoval={setConfirmBiometricRemoval}
            loadWebAuthn={loadWebAuthn}
          />

          <section className="config-card config-card--full">
            <div className="config-card-head">
              <span className="config-card-kicker">Ajuda</span>
              <h2 className="config-card-title-clean">Suporte humanizado</h2>
              <p className="config-card-subtitle">Precisa de ajuda? Fale diretamente com a nossa equipe pelo WhatsApp.</p>
            </div>
            <div className="config-quick-actions">
              <a
                href="https://wa.me/5554996994482?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20Severino"
                target="_blank"
                rel="noopener noreferrer"
                className="config-action-btn config-action-btn--whatsapp"
              >
                <svg viewBox="0 0 32 32" width="18" height="18" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M16.003 2.667C8.637 2.667 2.667 8.637 2.667 16c0 2.363.637 4.573 1.748 6.484L2.667 29.333l7.06-1.727A13.27 13.27 0 0 0 16.003 29.333C23.363 29.333 29.333 23.363 29.333 16S23.363 2.667 16.003 2.667Zm0 2.4c6.044 0 10.93 4.887 10.93 10.933 0 6.044-4.886 10.933-10.93 10.933a10.9 10.9 0 0 1-5.564-1.524l-.397-.24-4.19 1.025 1.063-3.99-.267-.413A10.9 10.9 0 0 1 5.073 16c0-6.046 4.886-10.933 10.93-10.933Zm-3.56 5.6c-.22 0-.577.083-.88.41-.303.328-1.156 1.13-1.156 2.754s1.183 3.196 1.348 3.418c.165.222 2.31 3.664 5.673 4.993 2.802 1.105 3.37.885 3.977.83.606-.055 1.954-.8 2.23-1.573.276-.772.276-1.434.193-1.572-.083-.138-.303-.22-.634-.386-.33-.165-1.954-.964-2.257-1.074-.303-.11-.524-.165-.744.165-.22.33-.855 1.074-1.047 1.295-.193.22-.386.248-.716.083-.33-.165-1.393-.514-2.654-1.637-.98-.875-1.642-1.956-1.835-2.287-.193-.33-.02-.51.145-.674.148-.148.33-.386.496-.578.165-.193.22-.33.33-.55.11-.22.055-.413-.028-.578-.083-.165-.73-1.8-1.018-2.463-.258-.613-.528-.556-.744-.566-.193-.01-.413-.01-.634-.01Z"/>
                </svg>
                Falar com suporte
              </a>
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

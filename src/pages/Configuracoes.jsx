import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
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
import ConfigNotificacoesCard from '../components/configuracoes/ConfigNotificacoesCard'
import ConfigPerfilCard from '../components/configuracoes/ConfigPerfilCard'
import ConfigFamiliaCard from '../components/configuracoes/ConfigFamiliaCard'
import { useTheme } from '../context/ThemeContext'
import { useConfigWebAuthn } from '../hooks/useConfigWebAuthn'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { showToast } from '../lib/toastStore'
import { redirectSe401 } from '../lib/authRedirect'
import { montarTextoConviteFamiliaComPwa } from '../lib/familiaConviteMensagemCompartilhavel'
import { getPublicAppOriginForConvites } from '../lib/publicAppOrigin'
import { formatPhoneBRDisplay, maskPhoneBRMobile, validatePhoneBRMobile } from '../lib/formatPhoneBR'
import { logoutHorizonte } from '../lib/logout'
import { fileToAvatarDataUrl } from '../lib/avatarImage'
import { PAPEL_CONVITE_OPCOES } from '../lib/familiaUi'

const SUPORTE_WA = 'https://wa.me/5554996994482'

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
  const [nomeEditando, setNomeEditando] = useState(false)
  const [nomeInput, setNomeInput] = useState('')
  const [nomeSaving, setNomeSaving] = useState(false)
  const fileInputRef = useRef(null)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [prefsSaving, setPrefsSaving] = useState('')
  const [sessoesTotal, setSessoesTotal] = useState(null)
  const [sessoesBusy, setSessoesBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [excluirModalOpen, setExcluirModalOpen] = useState(false)
  const [excluirInput, setExcluirInput] = useState('')
  const [excluirBusy, setExcluirBusy] = useState(false)

  const prefs = (perfil && typeof perfil.preferencias === 'object' && perfil.preferencias) || {}

  const salvarPreferencia = useCallback(async (key, value) => {
    setPrefsSaving(key)
    setPerfil((p) => ({ ...p, preferencias: { ...(p.preferencias || {}), [key]: value } }))
    try {
      const res = await apiFetch(apiUrl('/api/usuarios/perfil/preferencias'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferencias: { [key]: value } }),
      })
      if (redirectSe401(res)) return
      if (!res.ok) throw new Error()
      showToast('Preferência salva.')
    } catch {
      showToast('Erro ao salvar preferência.')
      setPerfil((p) => ({ ...p, preferencias: { ...(p.preferencias || {}), [key]: !value } }))
    } finally {
      setPrefsSaving('')
    }
  }, [])

  const handleAvatarFile = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Selecione um arquivo de imagem.'); return }
    setAvatarSaving(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      const res = await apiFetch(apiUrl('/api/usuarios/perfil/avatar'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: dataUrl }),
      })
      if (redirectSe401(res)) return
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(data.message || 'Erro ao salvar foto.'); return }
      const novo = data?.perfil?.avatar_url ?? dataUrl
      setPerfil((p) => {
        const upd = { ...p, avatar_url: novo }
        try { localStorage.setItem('horizonte_user', JSON.stringify(upd)) } catch { /* ignore */ }
        return upd
      })
      window.dispatchEvent(new Event('horizonte-session-refresh'))
      showToast('Foto atualizada!')
    } catch {
      showToast('Não consegui processar a imagem.')
    } finally {
      setAvatarSaving(false)
    }
  }, [])

  const removerFoto = useCallback(async () => {
    setAvatarSaving(true)
    try {
      const res = await apiFetch(apiUrl('/api/usuarios/perfil/avatar'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: null }),
      })
      if (redirectSe401(res)) return
      if (!res.ok) { const d = await res.json().catch(() => ({})); showToast(d.message || 'Erro ao remover foto.'); return }
      setPerfil((p) => {
        const upd = { ...p, avatar_url: null }
        try { localStorage.setItem('horizonte_user', JSON.stringify(upd)) } catch { /* ignore */ }
        return upd
      })
      window.dispatchEvent(new Event('horizonte-session-refresh'))
      showToast('Foto removida.')
    } catch {
      showToast('Erro ao remover foto.')
    } finally {
      setAvatarSaving(false)
    }
  }, [])

  const salvarNome = useCallback(async () => {
    const nome = nomeInput.trim()
    if (nome.length < 2) { showToast('Nome muito curto.'); return }
    setNomeSaving(true)
    try {
      const res = await apiFetch(apiUrl('/api/usuarios/perfil/nome'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome }),
      })
      const data = await res.json().catch(() => ({}))
      if (redirectSe401(res)) return
      if (!res.ok) throw new Error(data.message || 'Erro.')
      setPerfil((p) => ({ ...p, nome }))
      const u = { ...JSON.parse(localStorage.getItem('horizonte_user') || '{}'), nome }
      localStorage.setItem('horizonte_user', JSON.stringify(u))
      window.dispatchEvent(new Event('horizonte-session-refresh'))
      setNomeEditando(false)
      showToast('Nome atualizado.')
    } catch (e) {
      showToast(e.message || 'Erro ao atualizar nome.')
    } finally {
      setNomeSaving(false)
    }
  }, [nomeInput])

  const exportarDados = useCallback(async () => {
    setExportBusy(true)
    try {
      const res = await apiFetch(apiUrl('/api/usuarios/exportar'))
      if (redirectSe401(res)) return
      if (!res.ok) throw new Error()
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'severino-meus-dados.json'
      a.click()
      URL.revokeObjectURL(url)
      showToast('Download iniciado.')
    } catch {
      showToast('Erro ao exportar dados.')
    } finally {
      setExportBusy(false)
    }
  }, [])

  const encerrarSessoes = useCallback(async () => {
    setSessoesBusy(true)
    try {
      const res = await apiFetch(apiUrl('/api/usuarios/sessoes/encerrar'), { method: 'POST' })
      if (redirectSe401(res)) return
      if (!res.ok) throw new Error()
      setSessoesTotal(1)
      showToast('Outras sessões encerradas.')
    } catch {
      showToast('Erro ao encerrar sessões.')
    } finally {
      setSessoesBusy(false)
    }
  }, [])

  const excluirConta = useCallback(async () => {
    if (excluirInput.trim().toUpperCase() !== 'EXCLUIR') return
    setExcluirBusy(true)
    try {
      const res = await apiFetch(apiUrl('/api/usuarios/excluir-conta'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmacao: 'EXCLUIR' }),
      })
      if (!res.ok && res.status !== 401) throw new Error()
      logoutHorizonte()
    } catch {
      showToast('Erro ao excluir conta.')
      setExcluirBusy(false)
    }
  }, [excluirInput])

  // Carrega contagem de sessões ativas
  useEffect(() => {
    let cancel = false
    apiFetch(apiUrl('/api/usuarios/sessoes'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancel && d && typeof d.total === 'number') setSessoesTotal(d.total) })
      .catch(() => {})
    return () => { cancel = true }
  }, [])
  const usuarioIdHeader = String(perfil?.id ?? '').trim()


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
      const res = await apiFetch(apiUrl('/api/assinatura/status'), {
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
      const resM = await apiFetch(apiUrl('/api/familia/membros'))
      if (redirectSe401(resM)) return
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
      const resC = await apiFetch(apiUrl('/api/familia/convites'))
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
    apiFetch(apiUrl('/api/usuarios/perfil'))
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
      const res = await apiFetch(apiUrl('/api/usuarios/perfil/telefone'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: check.digits }),
      })
      const data = await res.json().catch(() => ({}))
      if (redirectSe401(res)) return
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

  // QR Code do link de convite (gerado localmente, sem serviço externo)
  const [conviteQr, setConviteQr] = useState('')
  useEffect(() => {
    if (!loginConviteHref) { setConviteQr(''); return }
    let cancel = false
    import('qrcode')
      .then((m) => (m.default || m).toDataURL(loginConviteHref, { margin: 1, width: 320, errorCorrectionLevel: 'M' }))
      .then((url) => { if (!cancel) setConviteQr(url) })
      .catch(() => { if (!cancel) setConviteQr('') })
    return () => { cancel = true }
  }, [loginConviteHref])

  // Compartilhar no WhatsApp (prioritário) — abre o app com a mensagem pronta
  const compartilharWhatsApp = useCallback(() => {
    const msg = textoConviteCompletoComPwa || loginConviteHref
    if (!msg) return
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
  }, [textoConviteCompletoComPwa, loginConviteHref])

  // Compartilhamento nativo (Web Share) quando disponível
  const compartilharNativo = useCallback(async () => {
    const text = textoConviteCompletoComPwa || ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Convite familiar — Severino', text, url: loginConviteHref || undefined })
      } catch { /* cancelado */ }
    } else {
      compartilharWhatsApp()
    }
  }, [textoConviteCompletoComPwa, loginConviteHref, compartilharWhatsApp])

  const criarConviteFamilia = async () => {
    if (!usuarioIdHeader || familiaBusy) return
    setFamiliaBusy(true)
    try {
      const res = await apiFetch(apiUrl('/api/familia/convites'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papel: novoConvitePapel }),
      })
      const data = await res.json().catch(() => ({}))
      if (redirectSe401(res)) return
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
        const res = await apiFetch(apiUrl(`/api/familia/convites/${familiaConfirm.id}`), {
          method: 'DELETE',
        })
        const data = await res.json().catch(() => ({}))
        if (redirectSe401(res)) return
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
            apiFetch(apiUrl(`/api/familia/convites/${id}`), {
              method: 'DELETE',
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
        const res = await apiFetch(apiUrl(`/api/familia/membros/${familiaConfirm.usuarioId}`), {
          method: 'DELETE',
        })
        const data = await res.json().catch(() => ({}))
        if (redirectSe401(res)) return
        if (!res.ok) {
          showToast(data.message || 'Não foi possível remover.')
          return
        }
        showToast(data.message || 'Membro removido.')
        await loadFamiliaPainel()
      } else if (familiaConfirm.type === 'sair') {
        const res = await apiFetch(apiUrl('/api/familia/sair'), {
          method: 'POST',
        })
        const data = await res.json().catch(() => ({}))
        if (redirectSe401(res)) return
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
      const res = await apiFetch(apiUrl(`/api/familia/membros/${membroId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
            <div className="dashboard-hub__hero-text config-hero-text">
              <h1 className="dashboard-hub__title">Ajustes</h1>
            </div>
          </div>
          <nav className="config-section-nav" aria-label="Seções de ajustes">
            {[
              { id: 'config-secao-conta', label: 'Conta' },
              { id: 'config-secao-aparencia', label: 'Aparência' },
              { id: 'config-secao-familia', label: 'Família' },
              { id: 'config-secao-seguranca', label: 'Segurança' },
              { id: 'config-secao-privacidade', label: 'Privacidade' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                className="config-section-nav__pill"
                onClick={() => {
                  const el = document.getElementById(s.id)
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </section>


        <div className="config-layout config-layout--clean">
          <ConfigPerfilCard
            perfil={perfil}
            avatarSaving={avatarSaving}
            fileInputRef={fileInputRef}
            removerFoto={removerFoto}
            handleAvatarFile={handleAvatarFile}
            nomeEditando={nomeEditando}
            nomeInput={nomeInput}
            setNomeInput={setNomeInput}
            nomeSaving={nomeSaving}
            salvarNome={salvarNome}
            setNomeEditando={setNomeEditando}
            telefoneLabel={telefoneLabel}
            usuarioIdHeader={usuarioIdHeader}
            abrirEditarTelefone={abrirEditarTelefone}
            familiaBusy={familiaBusy}
            setFamiliaConfirm={setFamiliaConfirm}
            telefoneEditando={telefoneEditando}
            telefoneInput={telefoneInput}
            setTelefoneInput={setTelefoneInput}
            telefoneSaving={telefoneSaving}
            salvarTelefone={salvarTelefone}
            cancelarEditarTelefone={cancelarEditarTelefone}
          />

          <ConfigAparenciaCard
            id="config-secao-aparencia"
            theme={theme}
            setTheme={setTheme}
            privacyMode={privacyMode}
            togglePrivacy={togglePrivacy}
          />

          {/* Central de notificações */}
          <ConfigNotificacoesCard prefs={prefs} prefsSaving={prefsSaving} onToggle={salvarPreferencia} />

          <ConfigFamiliaCard
            perfil={perfil}
            usuarioIdHeader={usuarioIdHeader}
            refreshAssinaturaPerfil={refreshAssinaturaPerfil}
            familiaTitular={familiaTitular}
            familiaMembros={familiaMembros}
            familiaConvites={familiaConvites}
            familiaBusy={familiaBusy}
            familiaLoadErr={familiaLoadErr}
            familiaVagasOcupadas={familiaVagasOcupadas}
            familiaLimiteConvitesAtingido={familiaLimiteConvitesAtingido}
            FAMILIA_MAX_VINCULADOS_UI={FAMILIA_MAX_VINCULADOS_UI}
            ultimoTokenConvite={ultimoTokenConvite}
            conviteCopiadoVisivel={conviteCopiadoVisivel}
            conviteQr={conviteQr}
            loginConviteHref={loginConviteHref}
            novoConvitePapel={novoConvitePapel}
            setNovoConvitePapel={setNovoConvitePapel}
            alterarPapelMembro={alterarPapelMembro}
            setAlterarPapelMembro={setAlterarPapelMembro}
            criarConviteFamilia={criarConviteFamilia}
            copiarConviteFamilia={copiarConviteFamilia}
            compartilharWhatsApp={compartilharWhatsApp}
            compartilharNativo={compartilharNativo}
            executarAlterarPapel={executarAlterarPapel}
            setFamiliaConfirm={setFamiliaConfirm}
            loadFamiliaPainel={loadFamiliaPainel}
          />

          <ConfigBiometriaCard
            id="config-secao-seguranca"
            usuarioIdHeader={usuarioIdHeader}
            webauthnList={webauthnList}
            webauthnLoading={webauthnLoading}
            webauthnError={webauthnError}
            bioRegistering={bioRegistering}
            handleRegisterBiometric={handleRegisterBiometric}
            setConfirmBiometricRemoval={setConfirmBiometricRemoval}
            loadWebAuthn={loadWebAuthn}
          />

          {/* Senha + sessões */}
          <section className="config-card config-card--full">
            <div className="config-card-head">
              <span className="config-card-kicker">Segurança</span>
              <h2 className="config-card-title-clean">Senha e sessões</h2>
              <p className="config-card-subtitle">
                Sessões ativas: <strong>{sessoesTotal == null ? '…' : sessoesTotal}</strong>{' '}
                {sessoesTotal != null && sessoesTotal > 1 ? '(este e outros dispositivos)' : '(este dispositivo)'}
              </p>
            </div>
            <div className="config-quick-actions">
              <a
                href={`${SUPORTE_WA}?text=${encodeURIComponent('Olá, quero trocar a senha da minha conta Severino.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="config-action-btn"
              >
                Trocar minha senha
              </a>
              <button
                type="button"
                className="config-action-btn"
                onClick={() => void encerrarSessoes()}
                disabled={sessoesBusy || (sessoesTotal != null && sessoesTotal <= 1)}
              >
                {sessoesBusy ? 'Encerrando…' : 'Sair de outros dispositivos'}
              </button>
            </div>
          </section>

          {/* Privacidade e dados (LGPD) */}
          <section className="config-card config-card--full" id="config-secao-privacidade">
            <div className="config-card-head">
              <span className="config-card-kicker">Privacidade</span>
              <h2 className="config-card-title-clean">Seus dados e privacidade</h2>
              <p className="config-card-subtitle">Você tem controle sobre seus dados. Exporte ou exclua quando quiser.</p>
            </div>
            <div className="config-quick-actions">
              <button type="button" className="config-action-btn" onClick={() => void exportarDados()} disabled={exportBusy}>
                {exportBusy ? 'Gerando…' : 'Exportar meus dados'}
              </button>
              <button
                type="button"
                className="config-action-btn config-action-btn--danger"
                onClick={() => { setExcluirInput(''); setExcluirModalOpen(true) }}
              >
                Excluir minha conta
              </button>
            </div>
          </section>

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

          <div className="config-layout__full-span config-logout-zone">
            <button type="button" className="config-logout-btn" onClick={logoutHorizonte}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
              Sair da conta
            </button>
          </div>
        </div>

        </RefDashboardScroll>
        </div>
      </main>
      </div>

      {excluirModalOpen && createPortal(
        <div className="config-excluir-overlay" role="dialog" aria-modal="true" aria-labelledby="excluir-title" onMouseDown={(e) => { if (e.target === e.currentTarget && !excluirBusy) setExcluirModalOpen(false) }}>
          <div className="config-excluir-modal">
            <span className="config-excluir-icon" aria-hidden>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </span>
            <h2 id="excluir-title" className="config-excluir-title">Excluir sua conta?</h2>
            <p className="config-excluir-body">
              Sua conta será desativada e o acesso encerrado em todos os dispositivos. Esta ação é <strong>irreversível</strong> —
              para recuperar, você precisará falar com o suporte dentro do prazo legal.
            </p>
            <label className="config-excluir-label" htmlFor="excluir-confirm">
              Digite <strong>EXCLUIR</strong> para confirmar
            </label>
            <input
              id="excluir-confirm"
              className="config-input config-excluir-input"
              value={excluirInput}
              onChange={(e) => setExcluirInput(e.target.value)}
              placeholder="EXCLUIR"
              autoComplete="off"
              disabled={excluirBusy}
            />
            <div className="config-excluir-actions">
              <button type="button" className="config-action-btn config-action-btn--primary" onClick={() => setExcluirModalOpen(false)} disabled={excluirBusy}>
                Manter minha conta
              </button>
              <button
                type="button"
                className="config-action-btn config-action-btn--danger-solid"
                onClick={() => void excluirConta()}
                disabled={excluirBusy || excluirInput.trim().toUpperCase() !== 'EXCLUIR'}
              >
                {excluirBusy ? 'Excluindo…' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

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

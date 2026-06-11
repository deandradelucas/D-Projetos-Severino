import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useModalA11y } from '../hooks/useModalA11y'
import './dashboard.css'
import '../styles/pages/metas.css'
import { useFabCompact } from '../hooks/useFabCompact'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import MetaIcon from '../components/MetaIcon'
import GamificacaoBloco from '../components/GamificacaoBloco'
import { META_ICON_KEYS, metaIconKey } from '../lib/metaIcons'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { redirectSeAuthBloqueada } from '../lib/authRedirect'
import { showToast } from '../lib/toastStore'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { maskCurrencyBRLInput, parseCurrencyBRLMasked, valorToMaskedBRL } from '../lib/currencyMaskBr'

function IconUsers() { return (<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>) }
function IconUser() { return (<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>) }
function IconMoreVertical() { return (<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>) }
function IconTarget() { return (<svg viewBox="0 0 24 24" aria-hidden="true" width="48" height="48" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>) }

const ICONES = META_ICON_KEYS
const CORES = ['gold', 'green', 'blue', 'purple', 'red', 'teal']

function pct(meta) {
  const alvo = Number(meta.valor_alvo) || 0
  const guardado = Number(meta.valor_guardado) || 0
  if (alvo <= 0) return 0
  return Math.min(100, Math.round((guardado / alvo) * 100))
}

function mesesAte(prazo) {
  if (!prazo) return null
  const hoje = new Date()
  const fim = new Date(`${String(prazo).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(fim.getTime())) return null
  const meses =
    (fim.getFullYear() - hoje.getFullYear()) * 12 + (fim.getMonth() - hoje.getMonth())
  return Math.max(0, meses)
}

function formatPrazoBr(prazo) {
  if (!prazo) return ''
  const d = new Date(`${String(prazo).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ──────────────────────────────────────────────────────────────────────────
// Modal: criar / editar meta
// ──────────────────────────────────────────────────────────────────────────
function ModalMeta({ onClose, onSalvar, salvando, metaEdit = null }) {
  const editando = Boolean(metaEdit)
  const [nome, setNome] = useState(metaEdit?.nome || '')
  const [icone, setIcone] = useState(() => metaIconKey(metaEdit?.icone))
  const [cor, setCor] = useState(metaEdit?.cor || 'gold')
  const [valorInput, setValorInput] = useState(metaEdit?.valor_alvo ? valorToMaskedBRL(Number(metaEdit.valor_alvo)) : '')
  const [prazo, setPrazo] = useState(metaEdit?.prazo ? String(metaEdit.prazo).slice(0, 10) : '')
  const modalRef = useRef(null)
  useModalA11y({ open: true, onClose, containerRef: modalRef, blockClose: salvando, autoFocus: false })

  const valorNum = parseCurrencyBRLMasked(valorInput)
  const podeSalvar = nome.trim().length >= 1 && Number.isFinite(valorNum) && valorNum >= 0.01

  function handleSubmit(e) {
    e.preventDefault()
    if (!podeSalvar || salvando) return
    onSalvar({ nome: nome.trim(), icone, cor, valor_alvo: valorNum, prazo: prazo || null })
  }

  return (
    <div className="page-metas__modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-metas__modal" role="dialog" aria-modal="true" aria-labelledby="meta-modal-title" ref={modalRef}>
        <div className="page-metas__modal-head">
          <h2 id="meta-modal-title" className="page-metas__modal-title">{editando ? 'Editar meta' : 'Nova meta'}</h2>
          <button type="button" className="page-metas__modal-close" onClick={onClose} aria-label="Fechar"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg></button>
        </div>
        <form onSubmit={handleSubmit} className="page-metas__modal-body">
          <label className="page-metas__field">
            <span className="page-metas__label">Nome da meta</span>
            <input
              className="page-metas__input"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value.slice(0, 80))}
              placeholder="Ex: Viagem, Reserva de emergência…"
              autoFocus
            />
          </label>

          <div className="page-metas__field">
            <span className="page-metas__label">Ícone</span>
            <div className="page-metas__icon-grid">
              {ICONES.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  className={`page-metas__icon-opt${metaIconKey(icone) === ic ? ' page-metas__icon-opt--active' : ''}`}
                  onClick={() => setIcone(ic)}
                  aria-label={`Ícone ${ic}`}
                >
                  <MetaIcon name={ic} size={20} />
                </button>
              ))}
            </div>
          </div>

          <div className="page-metas__field">
            <span className="page-metas__label">Cor</span>
            <div className="page-metas__cor-grid">
              {CORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`page-metas__cor-opt page-metas__cor-opt--${c}${cor === c ? ' page-metas__cor-opt--active' : ''}`}
                  onClick={() => setCor(c)}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="page-metas__row">
            <label className="page-metas__field">
              <span className="page-metas__label">Quanto quer juntar</span>
              <input
                className="page-metas__input"
                type="text"
                inputMode="numeric"
                value={valorInput}
                onChange={(e) => setValorInput(maskCurrencyBRLInput(e.target.value))}
                placeholder="R$ 0,00"
              />
            </label>
            <label className="page-metas__field">
              <span className="page-metas__label">Prazo <span className="page-metas__label-opt">(opcional)</span></span>
              <input
                className="page-metas__input"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </label>
          </div>

          <div className="page-metas__modal-actions">
            <button type="button" className="page-metas__btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="page-metas__btn-primary" disabled={!podeSalvar || salvando}>
              {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Criar meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Modal: guardar / resgatar valor
// ──────────────────────────────────────────────────────────────────────────
function ModalAporte({ meta, onClose, onConfirmar, salvando }) {
  const [tipo, setTipo] = useState('guardar') // 'guardar' | 'resgatar'
  const [valorInput, setValorInput] = useState('')
  const modalRef = useRef(null)
  useModalA11y({ open: true, onClose, containerRef: modalRef, blockClose: salvando, autoFocus: false })

  const valorNum = parseCurrencyBRLMasked(valorInput)
  const podeConfirmar = Number.isFinite(valorNum) && valorNum >= 0.01

  const alvo = Number(meta.valor_alvo) || 0
  const guardado = Number(meta.valor_guardado) || 0
  const falta = Math.max(0, Math.round((alvo - guardado) * 100) / 100)
  const meses = mesesAte(meta.prazo)
  const porMes = meses && meses > 0 && falta > 0 ? Math.ceil((falta / meses) * 100) / 100 : null

  function handleSubmit(e) {
    e.preventDefault()
    if (!podeConfirmar || salvando) return
    onConfirmar(tipo === 'guardar' ? valorNum : -valorNum)
  }

  return (
    <div className="page-metas__modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-metas__modal page-metas__modal--sm" role="dialog" aria-modal="true" aria-labelledby="aporte-modal-title" ref={modalRef}>
        <div className="page-metas__modal-head">
          <h2 id="aporte-modal-title" className="page-metas__modal-title"><MetaIcon name={meta.icone} size={18} /> {meta.nome}</h2>
          <button type="button" className="page-metas__modal-close" onClick={onClose} aria-label="Fechar"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg></button>
        </div>
        <form onSubmit={handleSubmit} className="page-metas__modal-body">
          <div className="page-metas__toggle">
            <button type="button" className={`page-metas__toggle-btn${tipo === 'guardar' ? ' page-metas__toggle-btn--active' : ''}`} onClick={() => setTipo('guardar')}>Guardar</button>
            <button type="button" className={`page-metas__toggle-btn${tipo === 'resgatar' ? ' page-metas__toggle-btn--active' : ''}`} onClick={() => setTipo('resgatar')}>Resgatar</button>
          </div>
          <label className="page-metas__field">
            <span className="page-metas__label">{tipo === 'guardar' ? 'Quanto guardar' : 'Quanto resgatar'}</span>
            <input
              className="page-metas__input page-metas__input--big"
              type="text"
              inputMode="numeric"
              value={valorInput}
              onChange={(e) => setValorInput(maskCurrencyBRLInput(e.target.value))}
              placeholder="R$ 0,00"
              autoFocus
            />
          </label>
          {tipo === 'guardar' && (
            <div className="page-metas__sugestoes">
              {porMes ? <button type="button" className="page-metas__sugestao" onClick={() => setValorInput(valorToMaskedBRL(porMes))}>{formatCurrencyBRL(porMes)}/mês</button> : null}
              {[50, 100].map((v) => (
                <button key={v} type="button" className="page-metas__sugestao" onClick={() => setValorInput(valorToMaskedBRL(v))}>+ {formatCurrencyBRL(v)}</button>
              ))}
              {falta > 0 ? <button type="button" className="page-metas__sugestao page-metas__sugestao--full" onClick={() => setValorInput(valorToMaskedBRL(falta))}>Completar</button> : null}
            </div>
          )}
          <p className="page-metas__aporte-hint">
            Guardado hoje: <strong>{formatCurrencyBRL(guardado)}</strong> de {formatCurrencyBRL(alvo)}
          </p>
          <div className="page-metas__modal-actions">
            <button type="button" className="page-metas__btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="page-metas__btn-primary" disabled={!podeConfirmar || salvando}>
              {salvando ? 'Salvando…' : tipo === 'guardar' ? 'Guardar' : 'Resgatar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Card de meta
// ──────────────────────────────────────────────────────────────────────────
function MetaCard({ meta, onGuardar, onEditar, onExcluir }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const progresso = pct(meta)
  const alvo = Number(meta.valor_alvo) || 0
  const guardado = Number(meta.valor_guardado) || 0
  const falta = Math.max(0, Math.round((alvo - guardado) * 100) / 100)
  const concluida = Boolean(meta.concluida_em) || guardado >= alvo
  const meses = mesesAte(meta.prazo)
  const porMes = meses && meses > 0 && falta > 0 ? falta / meses : null

  return (
    <article
      className={`page-metas__card page-metas__card--${meta.cor || 'gold'}${concluida ? ' page-metas__card--done' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onGuardar(meta)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGuardar(meta) } }}
      aria-label={`Guardar valor em ${meta.nome}`}
    >
      <div className="page-metas__card-head">
        <span className="page-metas__card-icon"><MetaIcon name={meta.icone} size={22} /></span>
        <div className="page-metas__card-titles">
          <h3 className="page-metas__card-name">{meta.nome}</h3>
          {meta.prazo && <span className="page-metas__card-prazo">até {formatPrazoBr(meta.prazo)}</span>}
        </div>
        <div className="page-metas__card-menu-wrap" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="page-metas__card-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Opções">{<IconMoreVertical />}</button>
          {menuOpen && (
            <>
              <div className="page-metas__menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="page-metas__menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEditar(meta) }}>Editar</button>
                <button type="button" role="menuitem" className="page-metas__menu--danger" onClick={() => { setMenuOpen(false); onExcluir(meta) }}>Excluir</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className="page-metas__bar"
        role="progressbar"
        aria-valuenow={progresso}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progresso da meta: ${progresso}%`}
      >
        <span className="page-metas__bar-fill" style={{ width: `${progresso}%` }} aria-hidden />
      </div>

      <div className="page-metas__card-values">
        <span className="page-metas__card-guardado">{formatCurrencyBRL(guardado)}</span>
        <span className="page-metas__card-alvo">de {formatCurrencyBRL(alvo)}</span>
        <span className="page-metas__card-pct">{progresso}%</span>
      </div>

      <p className="page-metas__card-status">
        {concluida ? (
          <span className="page-metas__done-tag">✓ Meta concluída!</span>
        ) : (
          <>
            Faltam <strong>{formatCurrencyBRL(falta)}</strong>
            {porMes ? <> · {formatCurrencyBRL(porMes)}/mês</> : null}
            {meses ? <> · {meses} {meses === 1 ? 'mês' : 'meses'}</> : null}
          </>
        )}
      </p>

      {!concluida && (
        <button type="button" className="page-metas__card-cta" onClick={(e) => { e.stopPropagation(); onGuardar(meta) }}>+ Guardar valor</button>
      )}
      {concluida && (
        <button type="button" className="page-metas__card-cta page-metas__card-cta--ghost" onClick={(e) => { e.stopPropagation(); onGuardar(meta) }}>Ajustar valor</button>
      )}
    </article>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Página
// ──────────────────────────────────────────────────────────────────────────
export default function Metas() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMembroConta, setIsMembroConta] = useState(false)
  const [escopo, setEscopo] = useState('familia') // 'familia' | 'pessoal'
  const [modalMeta, setModalMeta] = useState(false)
  const [metaEdit, setMetaEdit] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [aporteTarget, setAporteTarget] = useState(null)
  const [aporteSalvando, setAporteSalvando] = useState(false)
  const [excluirTarget, setExcluirTarget] = useState(null)
  const [filtro, setFiltro] = useState('ativas') // 'ativas' | 'concluidas' | 'todas'
  const [ordenar, setOrdenar] = useState('progresso') // 'progresso' | 'prazo' | 'valor'
  // FAB padrão: encolhe ao rolar (ver useFabCompact / AGENTS.md «FAB padrão»)
  const fabScrollRef = useRef(null)
  const fabCompact = useFabCompact(fabScrollRef)

  const metaConcluida = (m) => Boolean(m.concluida_em) || (Number(m.valor_guardado) || 0) >= (Number(m.valor_alvo) || 0)

  // Resumo agregado (total guardado, total das metas, % geral, próxima a concluir)
  const resumo = useMemo(() => {
    if (!metas.length) return null
    let guardado = 0, alvo = 0
    for (const m of metas) { guardado += Number(m.valor_guardado) || 0; alvo += Number(m.valor_alvo) || 0 }
    const ativas = metas.filter((m) => !metaConcluida(m))
    const proxima = ativas.length
      ? [...ativas].sort((a, b) => pct(b) - pct(a))[0]
      : null
    return {
      guardado, alvo,
      pctGeral: alvo > 0 ? Math.round((guardado / alvo) * 100) : 0,
      concluidas: metas.length - ativas.length,
      proxima,
    }
  }, [metas])

  // Filtro + ordenação
  const metasVisiveis = useMemo(() => {
    let arr = metas
    if (filtro === 'ativas') arr = metas.filter((m) => !metaConcluida(m))
    else if (filtro === 'concluidas') arr = metas.filter(metaConcluida)
    arr = [...arr]
    if (ordenar === 'valor') arr.sort((a, b) => (Number(b.valor_alvo) || 0) - (Number(a.valor_alvo) || 0))
    else if (ordenar === 'prazo') arr.sort((a, b) => String(a.prazo || '9999-99-99').localeCompare(String(b.prazo || '9999-99-99')))
    else arr.sort((a, b) => pct(b) - pct(a))
    return arr
  }, [metas, filtro, ordenar])

  const pessoalParam = isMembroConta && escopo === 'pessoal' ? '?pessoal=1' : ''

  const carregar = useCallback(async (pp = pessoalParam) => {
    setLoading(true)
    try {
      const res = await apiFetch(apiUrl(`/api/metas${pp}`), { cache: 'no-store' })
      if (redirectSeAuthBloqueada(res)) return
      if (!res.ok) throw new Error('Não foi possível carregar as metas.')
      const data = await res.json()
      setMetas(Array.isArray(data) ? data : [])
    } catch (e) {
      showToast(e.message || 'Erro ao carregar metas.', 'error')
      setMetas([])
    } finally {
      setLoading(false)
    }
  }, [pessoalParam])

  useEffect(() => {
    apiFetch(apiUrl('/api/familia/meu-escopo'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setIsMembroConta(!!data.isMembroConta) })
      .catch(() => {})
  }, [])

  useEffect(() => { void carregar(pessoalParam) }, [escopo]) // eslint-disable-line react-hooks/exhaustive-deps


  async function salvarMeta(payload) {
    setSalvando(true)
    try {
      const url = metaEdit ? `/api/metas/${metaEdit.id}${pessoalParam}` : `/api/metas${pessoalParam}`
      const res = await apiFetch(apiUrl(url), {
        method: metaEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (redirectSeAuthBloqueada(res)) return
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Erro ao salvar meta.') }
      setModalMeta(false); setMetaEdit(null)
      showToast(metaEdit ? 'Meta atualizada.' : 'Meta criada!', 'success')
      void carregar()
    } catch (e) {
      showToast(e.message || 'Erro ao salvar meta.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarAporte(valor) {
    if (!aporteTarget) return
    setAporteSalvando(true)
    try {
      const res = await apiFetch(apiUrl(`/api/metas/${aporteTarget.id}/aportes${pessoalParam}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor }),
      })
      if (redirectSeAuthBloqueada(res)) return
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Erro ao registrar valor.') }
      const atualizada = await res.json()
      if (atualizada?.concluida_em) showToast('🎉 Meta concluída! Parabéns!', 'success')
      setAporteTarget(null)
      void carregar()
    } catch (e) {
      showToast(e.message || 'Erro ao registrar valor.', 'error')
    } finally {
      setAporteSalvando(false)
    }
  }

  async function excluirMeta() {
    if (!excluirTarget) return
    try {
      const res = await apiFetch(apiUrl(`/api/metas/${excluirTarget.id}${pessoalParam}`), { method: 'DELETE' })
      if (redirectSeAuthBloqueada(res)) return
      if (!res.ok) throw new Error('Erro ao excluir meta.')
      setExcluirTarget(null)
      showToast('Meta excluída.', 'success')
      void carregar()
    } catch (e) {
      showToast(e.message || 'Erro ao excluir meta.', 'error')
    }
  }

  return (
    <div className="dashboard-container dashboard-page page-metas ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll ref={fabScrollRef}>
              <section className="dashboard-hub__hero" aria-label="Metas">
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                  <div className="dashboard-hub__hero-text">
                    <h1 className="dashboard-hub__title">Metas</h1>
                  </div>
                  <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Ações">
                    <button
                      type="button"
                      className="dashboard-hub__btn dashboard-hub__btn--primary"
                      onClick={() => { setMetaEdit(null); setModalMeta(true) }}
                    >
                      + Nova meta
                    </button>
                  </div>
                </div>
              </section>

              <section className="ref-bottom-grid ref-bottom-grid--single page-metas-panel" aria-label="Suas metas">
                {isMembroConta && (
                  <div className="page-metas__escopo">
                    <button type="button" className={`page-metas__escopo-btn${escopo === 'familia' ? ' page-metas__escopo-btn--active' : ''}`} onClick={() => setEscopo('familia')}><IconUsers /> Família</button>
                    <button type="button" className={`page-metas__escopo-btn${escopo === 'pessoal' ? ' page-metas__escopo-btn--active' : ''}`} onClick={() => setEscopo('pessoal')}><IconUser /> Pessoal</button>
                  </div>
                )}

                <GamificacaoBloco pessoalParam={pessoalParam} />

                {loading ? (
                  <p className="page-metas__loading">Carregando suas metas…</p>
                ) : metas.length === 0 ? (
                  <div className="page-metas__empty">
                    <span className="page-metas__empty-icon"><IconTarget /></span>
                    <h2 className="page-metas__empty-title">Crie sua primeira meta</h2>
                    <p className="page-metas__empty-desc">Junte dinheiro pra uma viagem, uma reserva de emergência ou aquele sonho. Acompanhe o progresso e guarde no seu ritmo.</p>
                    <button type="button" className="page-metas__empty-btn" onClick={() => { setMetaEdit(null); setModalMeta(true) }}>+ Criar meta</button>
                  </div>
                ) : (
                  <>
                    {resumo && (
                      <div className="page-metas__resumo">
                        <div className="page-metas__resumo-item">
                          <span className="page-metas__resumo-label">Total guardado</span>
                          <strong className="page-metas__resumo-valor">{formatCurrencyBRL(resumo.guardado)}<span className="page-metas__resumo-sub"> de {formatCurrencyBRL(resumo.alvo)}</span></strong>
                        </div>
                        <div className="page-metas__resumo-item">
                          <span className="page-metas__resumo-label">Progresso geral</span>
                          <strong className="page-metas__resumo-valor">{resumo.pctGeral}%</strong>
                        </div>
                        <div className="page-metas__resumo-item">
                          <span className="page-metas__resumo-label">{resumo.proxima ? 'Mais perto de concluir' : 'Metas concluídas'}</span>
                          <strong className="page-metas__resumo-valor">{resumo.proxima ? <>{resumo.proxima.nome} <span className="page-metas__resumo-sub">{pct(resumo.proxima)}%</span></> : `${resumo.concluidas}/${metas.length}`}</strong>
                        </div>
                      </div>
                    )}
                    {metas.length > 1 && (
                      <div className="page-metas__controls">
                        <div className="page-metas__sort" role="group" aria-label="Filtrar metas">
                          {[['ativas', 'Ativas'], ['concluidas', 'Concluídas'], ['todas', 'Todas']].map(([v, l]) => (
                            <button key={v} type="button" className={`page-metas__sort-btn${filtro === v ? ' page-metas__sort-btn--active' : ''}`} onClick={() => setFiltro(v)}>{l}</button>
                          ))}
                        </div>
                        <div className="page-metas__sort" role="group" aria-label="Ordenar metas">
                          <span className="page-metas__sort-label">Ordenar:</span>
                          {[['progresso', 'Progresso'], ['prazo', 'Prazo'], ['valor', 'Valor']].map(([v, l]) => (
                            <button key={v} type="button" className={`page-metas__sort-btn${ordenar === v ? ' page-metas__sort-btn--active' : ''}`} onClick={() => setOrdenar(v)}>{l}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {metasVisiveis.length === 0 ? (
                      <p className="page-metas__muted">Nenhuma meta {filtro === 'concluidas' ? 'concluída' : 'ativa'} no momento.</p>
                    ) : (
                      <div className="page-metas__grid">
                        {metasVisiveis.map((m) => (
                          <MetaCard
                            key={m.id}
                            meta={m}
                            onGuardar={(meta) => setAporteTarget(meta)}
                            onEditar={(meta) => { setMetaEdit(meta); setModalMeta(true) }}
                            onExcluir={(meta) => setExcluirTarget(meta)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </RefDashboardScroll>
          </div>
        </main>
      </div>

      {!modalMeta && !aporteTarget && (
        <div className="dashboard-mobile-fabs">
          <button
            type="button"
            className={`dashboard-mobile-tx-fab${fabCompact ? ' dashboard-mobile-tx-fab--compact' : ''}`}
            onClick={() => { setMetaEdit(null); setModalMeta(true) }}
            aria-label="Criar nova meta"
          >
            <span className="dashboard-mobile-tx-fab__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
            <span className="dashboard-mobile-tx-fab__label">Nova meta</span>
          </button>
        </div>
      )}

      {modalMeta && (
        <ModalMeta
          key={metaEdit?.id || 'nova'}
          metaEdit={metaEdit}
          salvando={salvando}
          onClose={() => { setModalMeta(false); setMetaEdit(null) }}
          onSalvar={salvarMeta}
        />
      )}
      {aporteTarget && (
        <ModalAporte
          key={aporteTarget.id}
          meta={aporteTarget}
          salvando={aporteSalvando}
          onClose={() => setAporteTarget(null)}
          onConfirmar={confirmarAporte}
        />
      )}
      <ConfirmDialog
        open={Boolean(excluirTarget)}
        title="Excluir meta?"
        message={excluirTarget ? `"${excluirTarget.nome}" e o histórico de aportes serão removidos. Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={excluirMeta}
        onClose={() => setExcluirTarget(null)}
      />
    </div>
  )
}

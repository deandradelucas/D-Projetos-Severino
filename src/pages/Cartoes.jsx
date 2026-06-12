import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './dashboard.css'
import '../styles/pages/cartoes.css'
import { useFabCompact } from '../hooks/useFabCompact'
import { useModalA11y } from '../hooks/useModalA11y'
import { useSheetDragClose } from '../hooks/useSheetDragClose'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { readHorizonteUser } from '../lib/horizonteSession'
import { readCartoesCache, writeCartoesCache } from '../lib/cartoesCachePersist'
import { redirectSeAuthBloqueada } from '../lib/authRedirect'
import { showToast } from '../lib/toastStore'
import { autoFocusDesktop } from '../lib/autoFocusDesktop'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { maskCurrencyBRLInput, parseCurrencyBRLMasked, valorToMaskedBRL } from '../lib/currencyMaskBr'

function IconUsers() { return (<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>) }
function IconUser() { return (<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>) }
function IconMoreVertical() { return (<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>) }
function IconChevronLeft() { return (<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>) }
function IconChevronRight() { return (<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>) }
function IconCard() { return (<svg viewBox="0 0 24 24" aria-hidden="true" width="48" height="48" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>) }

const BANDEIRAS = [
  { v: 'visa', l: 'Visa' },
  { v: 'master', l: 'Mastercard' },
  { v: 'elo', l: 'Elo' },
  { v: 'amex', l: 'Amex' },
  { v: 'hipercard', l: 'Hipercard' },
  { v: 'outro', l: 'Outro' },
]
const CORES = ['gold', 'green', 'blue', 'purple', 'red', 'teal', 'dark']

function fmtDataCurta(iso) {
  if (!iso) return ''
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
function fmtDataMed(iso) {
  if (!iso) return ''
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}
// dias até uma data ISO (a partir de hoje, meia-noite local)
function diasAteIso(iso) {
  if (!iso) return null
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((d - hoje) / 86400000)
}
// rótulo de vencimento com urgência relativa
function vencimentoLabel(iso) {
  const dias = diasAteIso(iso)
  if (dias === null) return ''
  if (dias < 0) return `venceu ${fmtDataCurta(iso)}`
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  if (dias <= 3) return `vence em ${dias} dias`
  return `vence ${fmtDataCurta(iso)}`
}
function labelBandeira(b) {
  const m = BANDEIRAS.find((x) => x.v === String(b || '').toLowerCase())
  return m ? m.l : (b ? String(b) : '')
}
// melhor dia de compra = dia seguinte ao fechamento (maior prazo até pagar)
function melhorDiaCompra(diaFech) {
  const f = Number(diaFech)
  if (!Number.isFinite(f) || f < 1) return null
  return f >= 28 ? 1 : f + 1
}
function refLabel(ref) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ref || ''))
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function shiftRef(ref, delta) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ref || ''))
  if (!m) return ref
  const d = new Date(Number(m[1]), Number(m[2]) - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ──────────────────────────────────────────────────────────────────────────
// Modal criar/editar cartão
// ──────────────────────────────────────────────────────────────────────────
function ModalCartao({ cartaoEdit, onClose, onSalvar, salvando }) {
  const editando = Boolean(cartaoEdit)
  const modalRef = useRef(null)
  useModalA11y({ open: true, onClose, containerRef: modalRef })
  useSheetDragClose(modalRef, { open: true, onClose })
  const [nome, setNome] = useState(cartaoEdit?.nome || '')
  const [bandeira, setBandeira] = useState(cartaoEdit?.bandeira || 'visa')
  const [cor, setCor] = useState(cartaoEdit?.cor || 'gold')
  const [limiteInput, setLimiteInput] = useState(cartaoEdit?.limite ? valorToMaskedBRL(Number(cartaoEdit.limite)) : '')
  const [fechamento, setFechamento] = useState(cartaoEdit?.dia_fechamento || 1)
  const [vencimento, setVencimento] = useState(cartaoEdit?.dia_vencimento || 10)

  const podeSalvar = nome.trim().length >= 1

  function handleSubmit(e) {
    e.preventDefault()
    if (!podeSalvar || salvando) return
    const limite = parseCurrencyBRLMasked(limiteInput)
    onSalvar({
      nome: nome.trim(),
      bandeira,
      cor,
      limite: Number.isFinite(limite) && limite > 0 ? limite : null,
      dia_fechamento: Number(fechamento),
      dia_vencimento: Number(vencimento),
    })
  }

  return (
    <div className="page-cartoes__modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} className="page-cartoes__modal" role="dialog" aria-modal="true" aria-labelledby="cartao-modal-title">
        <div className="page-cartoes__modal-head">
          <h2 id="cartao-modal-title" className="page-cartoes__modal-title">{editando ? 'Editar cartão' : 'Novo cartão'}</h2>
          <button type="button" className="page-cartoes__modal-close" onClick={onClose} aria-label="Fechar"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg></button>
        </div>
        <form onSubmit={handleSubmit} className="page-cartoes__modal-body">
          <label className="page-cartoes__field">
            <span className="page-cartoes__label">Nome do cartão</span>
            <input className="page-cartoes__input" type="text" value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} placeholder="Ex: Nubank, Itaú Black…" autoFocus={autoFocusDesktop()} />
          </label>

          <div className="page-cartoes__row">
            <label className="page-cartoes__field">
              <span className="page-cartoes__label">Bandeira</span>
              <select className="page-cartoes__input" value={bandeira} onChange={(e) => setBandeira(e.target.value)}>
                {BANDEIRAS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
              </select>
            </label>
            <label className="page-cartoes__field">
              <span className="page-cartoes__label">Limite <span className="page-cartoes__label-opt">(opcional)</span></span>
              <input className="page-cartoes__input" type="text" inputMode="numeric" value={limiteInput} onChange={(e) => setLimiteInput(maskCurrencyBRLInput(e.target.value))} placeholder="R$ 0,00" />
            </label>
          </div>

          <div className="page-cartoes__row">
            <label className="page-cartoes__field">
              <span className="page-cartoes__label">Dia de fechamento</span>
              <select className="page-cartoes__input" value={fechamento} onChange={(e) => setFechamento(e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Dia {d}</option>)}
              </select>
            </label>
            <label className="page-cartoes__field">
              <span className="page-cartoes__label">Dia de vencimento</span>
              <select className="page-cartoes__input" value={vencimento} onChange={(e) => setVencimento(e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Dia {d}</option>)}
              </select>
            </label>
          </div>

          <div className="page-cartoes__field">
            <span className="page-cartoes__label">Cor</span>
            <div className="page-cartoes__cor-grid">
              {CORES.map((c) => (
                <button key={c} type="button" className={`page-cartoes__cor-opt page-cartoes__cor-opt--${c}${cor === c ? ' page-cartoes__cor-opt--active' : ''}`} onClick={() => setCor(c)} aria-label={`Cor ${c}`} />
              ))}
            </div>
          </div>

          <div className="page-cartoes__modal-actions">
            <button type="button" className="page-cartoes__btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="page-cartoes__btn-primary" disabled={!podeSalvar || salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar' : 'Criar cartão'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Modal fatura (com navegação de mês)
// ──────────────────────────────────────────────────────────────────────────
function ModalFatura({ cartao, pessoalParam, onClose }) {
  const [ref, setRef] = useState(cartao.fatura_atual?.ref || '')
  const modalRef = useRef(null)
  useModalA11y({ open: true, onClose, containerRef: modalRef })
  useSheetDragClose(modalRef, { open: true, onClose })
  const [fatura, setFatura] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState(null) // null = não está buscando
  const [buscando, setBuscando] = useState(false)
  const buscaAtiva = busca.trim().length >= 2
  const [aba, setAba] = useState('fatura') // 'fatura' | 'parceladas'
  const [parceladas, setParceladas] = useState(null)
  const [loadingParc, setLoadingParc] = useState(false)

  // Compras parceladas ativas do cartão (aba Parceladas)
  useEffect(() => {
    if (aba !== 'parceladas') return undefined
    let cancel = false
    const load = async () => {
      setLoadingParc(true)
      const sep = pessoalParam ? '?pessoal=1' : ''
      try {
        const res = await apiFetch(apiUrl(`/api/cartoes/${cartao.id}/parceladas${sep}`), { cache: 'no-store' })
        const data = res.ok ? await res.json() : []
        if (!cancel) setParceladas(Array.isArray(data) ? data : [])
      } catch { if (!cancel) setParceladas([]) } finally {
        if (!cancel) setLoadingParc(false)
      }
    }
    void load()
    return () => { cancel = true }
  }, [aba, cartao.id, pessoalParam])

  // Fatura do mês (quando não está buscando)
  useEffect(() => {
    if (buscaAtiva) return undefined
    let cancel = false
    const load = async () => {
      setLoading(true)
      const q = ref ? `?ref=${ref}${pessoalParam ? `&${pessoalParam.slice(1)}` : ''}` : pessoalParam
      try {
        const res = await apiFetch(apiUrl(`/api/cartoes/${cartao.id}/fatura${q}`), { cache: 'no-store' })
        const data = res.ok ? await res.json() : null
        if (!cancel && data) { setFatura(data); setRef(data.ref) }
      } catch { /* silencioso */ } finally {
        if (!cancel) setLoading(false)
      }
    }
    void load()
    return () => { cancel = true }
  }, [ref, cartao.id, pessoalParam, buscaAtiva])

  // Busca no histórico completo (debounce)
  useEffect(() => {
    if (!buscaAtiva) { setResultados(null); return undefined }
    let cancel = false
    const t = setTimeout(async () => {
      setBuscando(true)
      const sep = pessoalParam ? '&pessoal=1' : ''
      try {
        const res = await apiFetch(apiUrl(`/api/cartoes/${cartao.id}/transacoes?q=${encodeURIComponent(busca.trim())}${sep}`), { cache: 'no-store' })
        const data = res.ok ? await res.json() : []
        if (!cancel) setResultados(Array.isArray(data) ? data : [])
      } catch { if (!cancel) setResultados([]) } finally {
        if (!cancel) setBuscando(false)
      }
    }, 350)
    return () => { cancel = true; clearTimeout(t) }
  }, [busca, buscaAtiva, cartao.id, pessoalParam])

  return (
    <div className="page-cartoes__modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} className="page-cartoes__modal page-cartoes__modal--fatura" role="dialog" aria-modal="true" aria-labelledby="fatura-modal-title">
        <div className="page-cartoes__modal-head">
          <h2 id="fatura-modal-title" className="page-cartoes__modal-title">{cartao.nome}</h2>
          <button type="button" className="page-cartoes__modal-close" onClick={onClose} aria-label="Fechar"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg></button>
        </div>

        <div className="page-cartoes__fatura-scroll">
        <div className="page-cartoes__abas" role="tablist">
          <button type="button" role="tab" aria-selected={aba === 'fatura'} className={`page-cartoes__aba${aba === 'fatura' ? ' is-ativa' : ''}`} onClick={() => setAba('fatura')}>Fatura</button>
          <button type="button" role="tab" aria-selected={aba === 'parceladas'} className={`page-cartoes__aba${aba === 'parceladas' ? ' is-ativa' : ''}`} onClick={() => setAba('parceladas')}>Parceladas</button>
        </div>

        {aba === 'parceladas' ? (
          <div className="page-cartoes__fatura-body">
            {loadingParc ? (
              <p className="page-cartoes__muted">Carregando…</p>
            ) : !parceladas || parceladas.length === 0 ? (
              <p className="page-cartoes__muted">Nenhuma compra parcelada em andamento neste cartão.</p>
            ) : (
              <ul className="page-cartoes__parc-list">
                {parceladas.map((p) => (
                  <li key={p.grupo_id} className="page-cartoes__parc">
                    <div className="page-cartoes__parc-top">
                      <span className="page-cartoes__parc-desc">{p.descricao || 'Compra parcelada'}</span>
                      <span className="page-cartoes__parc-restante">{formatCurrencyBRL(p.valor_restante)}</span>
                    </div>
                    <div className="page-cartoes__parc-meta">
                      <span>{p.pagas}/{p.total} pagas · {formatCurrencyBRL(p.valor_parcela)}/mês</span>
                      {p.proximo_vencimento && <span>próx. {fmtDataCurta(p.proximo_vencimento)}</span>}
                    </div>
                    <div className="page-cartoes__parc-bar" aria-hidden>
                      <div className="page-cartoes__parc-bar-fill" style={{ width: `${p.total ? Math.round((p.pagas / p.total) * 100) : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <>
        <div className="page-cartoes__busca">
          <input
            type="search"
            className="page-cartoes__busca-input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no histórico do cartão…"
            aria-label="Buscar no histórico do cartão"
          />
        </div>

        {!buscaAtiva && (
          <>
            <div className="page-cartoes__fatura-nav">
              <button type="button" onClick={() => setRef((r) => shiftRef(r, -1))} aria-label="Mês anterior"><IconChevronLeft /></button>
              <span className="page-cartoes__fatura-mes">{refLabel(ref)}</span>
              <button type="button" onClick={() => setRef((r) => shiftRef(r, 1))} aria-label="Próximo mês"><IconChevronRight /></button>
            </div>
            <div className="page-cartoes__fatura-resumo">
              <div className="page-cartoes__fatura-resumo-main">
                <span className="page-cartoes__fatura-total-label">Total da fatura</span>
                <span className="page-cartoes__fatura-total">{fatura ? formatCurrencyBRL(fatura.total) : '—'}</span>
              </div>
              {fatura?.vencimento && <span className="page-cartoes__fatura-venc">vence {fmtDataCurta(fatura.vencimento)}</span>}
            </div>
          </>
        )}

        <div className="page-cartoes__fatura-body">
          {buscaAtiva ? (
            buscando ? (
              <p className="page-cartoes__muted">Buscando…</p>
            ) : !resultados || resultados.length === 0 ? (
              <p className="page-cartoes__muted">Nada encontrado para “{busca.trim()}”.</p>
            ) : (
              <ul className="page-cartoes__tx-list">
                {resultados.map((t) => (
                  <li key={t.id} className="page-cartoes__tx">
                    <div className="page-cartoes__tx-info">
                      <span className="page-cartoes__tx-desc">{t.descricao || 'Sem descrição'}</span>
                      <span className="page-cartoes__tx-meta">
                        {fmtDataMed(t.data_transacao)}
                        {t.recorrente_total ? ` · ${t.recorrente_index}/${t.recorrente_total}` : ''}
                      </span>
                    </div>
                    <span className={`page-cartoes__tx-valor${t.tipo === 'receita' ? ' page-cartoes__tx-valor--in' : ''}`}>
                      {t.tipo === 'receita' ? '+' : '−'} {formatCurrencyBRL(Number(t.valor) || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : loading ? (
            <p className="page-cartoes__muted">Carregando…</p>
          ) : !fatura || fatura.transacoes.length === 0 ? (
            <p className="page-cartoes__muted">Nenhum lançamento nessa fatura.</p>
          ) : (
            <ul className="page-cartoes__tx-list">
              {fatura.transacoes.map((t) => (
                <li key={t.id} className="page-cartoes__tx">
                  <div className="page-cartoes__tx-info">
                    <span className="page-cartoes__tx-desc">{t.descricao || 'Sem descrição'}</span>
                    <span className="page-cartoes__tx-meta">
                      {fmtDataCurta(t.data_transacao)}
                      {t.recorrente_total ? ` · ${t.recorrente_index}/${t.recorrente_total}` : ''}
                    </span>
                  </div>
                  <span className={`page-cartoes__tx-valor${t.tipo === 'receita' ? ' page-cartoes__tx-valor--in' : ''}`}>
                    {t.tipo === 'receita' ? '+' : '−'} {formatCurrencyBRL(Number(t.valor) || 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        </>
        )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Card de cartão
// ──────────────────────────────────────────────────────────────────────────
function CartaoCard({ cartao, onVerFatura, onEditar, onExcluir }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const fatura = cartao.fatura_atual || {}
  const total = Number(fatura.total) || 0
  const limite = Number(cartao.limite) || 0
  const usoPct = limite > 0 ? Math.min(100, Math.round((total / limite) * 100)) : null
  const dias = diasAteIso(fatura.vencimento)
  const vencUrgente = dias !== null && dias >= 0 && dias <= 3
  const bandeira = labelBandeira(cartao.bandeira)
  const melhorDia = melhorDiaCompra(cartao.dia_fechamento)
  const abrirFatura = () => onVerFatura(cartao)

  return (
    <article
      className={`page-cartoes__card page-cartoes__card--${cartao.cor || 'gold'}`}
      role="button"
      tabIndex={0}
      onClick={abrirFatura}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirFatura() } }}
      aria-label={`Ver fatura de ${cartao.nome}`}
    >
      <div className="page-cartoes__card-top">
        <div className="page-cartoes__card-brand">
          <span className="page-cartoes__card-chip" aria-hidden />
          <span className="page-cartoes__card-nome">{cartao.nome}</span>
          {bandeira && <span className="page-cartoes__card-bandeira">{bandeira}</span>}
        </div>
        <div className="page-cartoes__card-menu-wrap" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="page-cartoes__card-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Opções">{<IconMoreVertical />}</button>
          {menuOpen && (
            <>
              <div className="page-cartoes__menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="page-cartoes__menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEditar(cartao) }}>Editar</button>
                <button type="button" role="menuitem" className="page-cartoes__menu--danger" onClick={() => { setMenuOpen(false); onExcluir(cartao) }}>Excluir</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="page-cartoes__card-fatura">
        <span className="page-cartoes__card-fatura-label">Fatura atual</span>
        <span className="page-cartoes__card-fatura-total">{formatCurrencyBRL(total)}</span>
        {fatura.vencimento && (
          <span className={`page-cartoes__card-venc${vencUrgente ? ' page-cartoes__card-venc--urgente' : ''}`}>
            {vencimentoLabel(fatura.vencimento)}
          </span>
        )}
      </div>

      {usoPct !== null && (
        <div className="page-cartoes__limite">
          <div className="page-cartoes__limite-bar"><span className="page-cartoes__limite-fill" style={{ width: `${usoPct}%` }} /></div>
          <span className="page-cartoes__limite-txt">Usado {formatCurrencyBRL(total)} de {formatCurrencyBRL(limite)} · {usoPct}%</span>
        </div>
      )}

      {cartao.dia_fechamento ? (
        <span className="page-cartoes__card-fech">
          Fecha dia {cartao.dia_fechamento}{melhorDia ? ` · melhor compra dia ${melhorDia}` : ''}
        </span>
      ) : null}

      <button type="button" className="page-cartoes__card-cta" onClick={(e) => { e.stopPropagation(); abrirFatura() }}>Ver fatura</button>
    </article>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Página
// ──────────────────────────────────────────────────────────────────────────
export default function Cartoes() {
  // Hidrata do cache persistido no cold start → pinta os cartões na hora, sem
  // spinner, e revalida em background. Calculado uma vez (ref).
  const cacheInicialRef = useRef(undefined)
  if (cacheInicialRef.current === undefined) {
    const u = readHorizonteUser()
    const cached = u?.id ? readCartoesCache(u.id) : null
    cacheInicialRef.current = Array.isArray(cached) && cached.length ? cached : null
  }
  const cartoesCache = cacheInicialRef.current
  const hidratadoRef = useRef(!!cartoesCache)
  const montadoRef = useRef(false)

  const [menuAberto, setMenuAberto] = useState(false)
  const [cartoes, setCartoes] = useState(cartoesCache || [])
  const [loading, setLoading] = useState(!cartoesCache)
  const [isMembroConta, setIsMembroConta] = useState(false)
  const [escopo, setEscopo] = useState('familia')
  const [modalCartao, setModalCartao] = useState(false)
  const [cartaoEdit, setCartaoEdit] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [faturaTarget, setFaturaTarget] = useState(null)
  const [excluirTarget, setExcluirTarget] = useState(null)
  const [ordenar, setOrdenar] = useState('vencimento') // 'vencimento' | 'valor'
  // FAB padrão: encolhe ao rolar (ver useFabCompact / AGENTS.md «FAB padrão»)
  const fabScrollRef = useRef(null)
  const fabCompact = useFabCompact(fabScrollRef)

  // Resumo agregado de todos os cartões (total a pagar, limite usado, próximo vencimento)
  const resumo = useMemo(() => {
    if (!cartoes.length) return null
    let totalPagar = 0, totalLimite = 0, totalUsado = 0, proxVenc = null
    for (const c of cartoes) {
      const t = Number(c.fatura_atual?.total) || 0
      totalPagar += t
      const lim = Number(c.limite) || 0
      if (lim > 0) { totalLimite += lim; totalUsado += t }
      const v = c.fatura_atual?.vencimento
      if (v && (!proxVenc || v < proxVenc)) proxVenc = v
    }
    return { totalPagar, totalLimite, pctUso: totalLimite > 0 ? Math.round((totalUsado / totalLimite) * 100) : null, proxVenc }
  }, [cartoes])

  // Ordenação dos cartões (vencimento mais próximo ou maior fatura)
  const cartoesOrdenados = useMemo(() => {
    const arr = [...cartoes]
    if (ordenar === 'valor') {
      arr.sort((a, b) => (Number(b.fatura_atual?.total) || 0) - (Number(a.fatura_atual?.total) || 0))
    } else {
      arr.sort((a, b) => String(a.fatura_atual?.vencimento || '9999-99-99').localeCompare(String(b.fatura_atual?.vencimento || '9999-99-99')))
    }
    return arr
  }, [cartoes, ordenar])

  const pessoalParam = isMembroConta && escopo === 'pessoal' ? '?pessoal=1' : ''

  const carregar = useCallback(async (pp = pessoalParam, { silent = false } = {}) => {
    // Com cache hidratado, revalida em background (sem flash de spinner).
    if (!silent) setLoading(true)
    try {
      const res = await apiFetch(apiUrl(`/api/cartoes${pp}`), { cache: 'no-store' })
      if (redirectSeAuthBloqueada(res)) return
      if (!res.ok) throw new Error('Não foi possível carregar os cartões.')
      const data = await res.json()
      const lista = Array.isArray(data) ? data : []
      setCartoes(lista)
      // Persiste só o snapshot do escopo padrão (sem ?pessoal=1) p/ cold start.
      if (pp === '') {
        const u = readHorizonteUser()
        if (u?.id) writeCartoesCache(u.id, lista)
      }
    } catch (e) {
      showToast(e.message || 'Erro ao carregar cartões.', 'error')
      setCartoes([])
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

  // 1ª carga (mount) revalida em silêncio se hidratou do cache; troca de escopo
  // mostra o loading normalmente.
  useEffect(() => {
    const silent = !montadoRef.current && hidratadoRef.current
    montadoRef.current = true
    void carregar(pessoalParam, { silent })
  }, [escopo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function salvarCartao(payload) {
    setSalvando(true)
    try {
      const url = cartaoEdit ? `/api/cartoes/${cartaoEdit.id}${pessoalParam}` : `/api/cartoes${pessoalParam}`
      const res = await apiFetch(apiUrl(url), {
        method: cartaoEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (redirectSeAuthBloqueada(res)) return
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Erro ao salvar cartão.') }
      setModalCartao(false); setCartaoEdit(null)
      showToast(cartaoEdit ? 'Cartão atualizado.' : 'Cartão criado!', 'success')
      void carregar()
    } catch (e) {
      showToast(e.message || 'Erro ao salvar cartão.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function excluirCartao() {
    if (!excluirTarget) return
    try {
      const res = await apiFetch(apiUrl(`/api/cartoes/${excluirTarget.id}${pessoalParam}`), { method: 'DELETE' })
      if (redirectSeAuthBloqueada(res)) return
      if (!res.ok) throw new Error('Erro ao excluir cartão.')
      setExcluirTarget(null)
      showToast('Cartão excluído.', 'success')
      void carregar()
    } catch (e) {
      showToast(e.message || 'Erro ao excluir cartão.', 'error')
    }
  }

  return (
    <div className="dashboard-container dashboard-page page-cartoes ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll ref={fabScrollRef}>
              <section className="dashboard-hub__hero" aria-label="Cartões">
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                  <div className="dashboard-hub__hero-text">
                    <div className="page-cartoes__title-row">
                      <h1 className="dashboard-hub__title">Cartões</h1>
                      {!loading && cartoes.length > 0 && (
                        <span className="page-cartoes__count-badge" aria-label={`${cartoes.length} ${cartoes.length === 1 ? 'cartão' : 'cartões'}`}>
                          {cartoes.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Ações">
                    <button type="button" className="dashboard-hub__btn dashboard-hub__btn--primary" onClick={() => { setCartaoEdit(null); setModalCartao(true) }}>+ Novo cartão</button>
                  </div>
                </div>
              </section>

              <section className="ref-bottom-grid ref-bottom-grid--single page-cartoes-panel" aria-label="Seus cartões">
                {isMembroConta && (
                  <div className="page-cartoes__escopo">
                    <button type="button" className={`page-cartoes__escopo-btn${escopo === 'familia' ? ' page-cartoes__escopo-btn--active' : ''}`} onClick={() => setEscopo('familia')}><IconUsers /> Família</button>
                    <button type="button" className={`page-cartoes__escopo-btn${escopo === 'pessoal' ? ' page-cartoes__escopo-btn--active' : ''}`} onClick={() => setEscopo('pessoal')}><IconUser /> Pessoal</button>
                  </div>
                )}

                {loading ? (
                  <p className="page-cartoes__muted">Carregando seus cartões…</p>
                ) : cartoes.length === 0 ? (
                  <div className="page-cartoes__empty">
                    <span className="page-cartoes__empty-icon"><IconCard /></span>
                    <h2 className="page-cartoes__empty-title">Cadastre seu primeiro cartão</h2>
                    <p className="page-cartoes__empty-desc">Acompanhe a fatura de cada cartão em tempo real, com data de fechamento e vencimento. As despesas que você marca como do cartão entram na fatura certa automaticamente.</p>
                    <button type="button" className="page-cartoes__empty-btn" onClick={() => { setCartaoEdit(null); setModalCartao(true) }}>+ Adicionar cartão</button>
                  </div>
                ) : (
                  <>
                    {resumo && (
                      <div className="page-cartoes__resumo">
                        <div className="page-cartoes__resumo-item">
                          <span className="page-cartoes__resumo-label">Total a pagar</span>
                          <strong className="page-cartoes__resumo-valor">{formatCurrencyBRL(resumo.totalPagar)}</strong>
                        </div>
                        {resumo.pctUso !== null && (
                          <div className="page-cartoes__resumo-item">
                            <span className="page-cartoes__resumo-label">Limite usado</span>
                            <strong className="page-cartoes__resumo-valor">{resumo.pctUso}%<span className="page-cartoes__resumo-sub"> de {formatCurrencyBRL(resumo.totalLimite)}</span></strong>
                          </div>
                        )}
                        {resumo.proxVenc && (
                          <div className="page-cartoes__resumo-item">
                            <span className="page-cartoes__resumo-label">Próximo vencimento</span>
                            <strong className="page-cartoes__resumo-valor">{vencimentoLabel(resumo.proxVenc)}</strong>
                          </div>
                        )}
                      </div>
                    )}
                    {cartoes.length > 1 && (
                      <div className="page-cartoes__sort" role="group" aria-label="Ordenar cartões">
                        <span className="page-cartoes__sort-label">Ordenar:</span>
                        <button type="button" className={`page-cartoes__sort-btn${ordenar === 'vencimento' ? ' page-cartoes__sort-btn--active' : ''}`} onClick={() => setOrdenar('vencimento')}>Vencimento</button>
                        <button type="button" className={`page-cartoes__sort-btn${ordenar === 'valor' ? ' page-cartoes__sort-btn--active' : ''}`} onClick={() => setOrdenar('valor')}>Valor</button>
                      </div>
                    )}
                    <div className="page-cartoes__grid">
                      {cartoesOrdenados.map((c) => (
                        <CartaoCard
                          key={c.id}
                          cartao={c}
                          onVerFatura={(cartao) => setFaturaTarget(cartao)}
                          onEditar={(cartao) => { setCartaoEdit(cartao); setModalCartao(true) }}
                          onExcluir={(cartao) => setExcluirTarget(cartao)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>
            </RefDashboardScroll>
          </div>
        </main>
      </div>

      {!modalCartao && !faturaTarget && (
        <div className="dashboard-mobile-fabs">
          <button
            type="button"
            className={`dashboard-mobile-tx-fab${fabCompact ? ' dashboard-mobile-tx-fab--compact' : ''}`}
            onClick={() => { setCartaoEdit(null); setModalCartao(true) }}
            aria-label="Criar novo cartão"
          >
            <span className="dashboard-mobile-tx-fab__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
            <span className="dashboard-mobile-tx-fab__label">Novo cartão</span>
          </button>
        </div>
      )}

      {modalCartao && (
        <ModalCartao
          key={cartaoEdit?.id || 'novo'}
          cartaoEdit={cartaoEdit}
          salvando={salvando}
          onClose={() => { setModalCartao(false); setCartaoEdit(null) }}
          onSalvar={salvarCartao}
        />
      )}
      {faturaTarget && (
        <ModalFatura
          key={faturaTarget.id}
          cartao={faturaTarget}
          pessoalParam={pessoalParam}
          onClose={() => setFaturaTarget(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(excluirTarget)}
        title="Excluir cartão?"
        message={excluirTarget ? `"${excluirTarget.nome}" será removido. As despesas vinculadas a ele serão desvinculadas (não apagadas).` : ''}
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={excluirCartao}
        onClose={() => setExcluirTarget(null)}
      />
    </div>
  )
}

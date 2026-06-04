import { useCallback, useEffect, useMemo, useState } from 'react'
import './dashboard.css'
import './metas.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { redirectSe401, redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
import { showToast } from '../lib/toastStore'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { maskCurrencyBRLInput, parseCurrencyBRLMasked, valorToMaskedBRL } from '../lib/currencyMaskBr'

const ICONES = ['🎯', '✈️', '🏠', '🚗', '💍', '🎓', '🏖️', '💻', '🛡️', '🎁', '👶', '💰']
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
  const [icone, setIcone] = useState(metaEdit?.icone || '🎯')
  const [cor, setCor] = useState(metaEdit?.cor || 'gold')
  const [valorInput, setValorInput] = useState(metaEdit?.valor_alvo ? valorToMaskedBRL(Number(metaEdit.valor_alvo)) : '')
  const [prazo, setPrazo] = useState(metaEdit?.prazo ? String(metaEdit.prazo).slice(0, 10) : '')

  const valorNum = parseCurrencyBRLMasked(valorInput)
  const podeSalvar = nome.trim().length >= 1 && Number.isFinite(valorNum) && valorNum >= 0.01

  function handleSubmit(e) {
    e.preventDefault()
    if (!podeSalvar || salvando) return
    onSalvar({ nome: nome.trim(), icone, cor, valor_alvo: valorNum, prazo: prazo || null })
  }

  return (
    <div className="page-metas__modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-metas__modal" role="dialog" aria-modal="true" aria-labelledby="meta-modal-title">
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
                  className={`page-metas__icon-opt${icone === ic ? ' page-metas__icon-opt--active' : ''}`}
                  onClick={() => setIcone(ic)}
                  aria-label={`Ícone ${ic}`}
                >
                  {ic}
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

  const valorNum = parseCurrencyBRLMasked(valorInput)
  const podeConfirmar = Number.isFinite(valorNum) && valorNum >= 0.01

  function handleSubmit(e) {
    e.preventDefault()
    if (!podeConfirmar || salvando) return
    onConfirmar(tipo === 'guardar' ? valorNum : -valorNum)
  }

  return (
    <div className="page-metas__modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-metas__modal page-metas__modal--sm" role="dialog" aria-modal="true" aria-labelledby="aporte-modal-title">
        <div className="page-metas__modal-head">
          <h2 id="aporte-modal-title" className="page-metas__modal-title">{meta.icone} {meta.nome}</h2>
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
          <p className="page-metas__aporte-hint">
            Guardado hoje: <strong>{formatCurrencyBRL(Number(meta.valor_guardado) || 0)}</strong> de {formatCurrencyBRL(Number(meta.valor_alvo) || 0)}
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
    <article className={`page-metas__card page-metas__card--${meta.cor || 'gold'}${concluida ? ' page-metas__card--done' : ''}`}>
      <div className="page-metas__card-head">
        <span className="page-metas__card-icon">{meta.icone || '🎯'}</span>
        <div className="page-metas__card-titles">
          <h3 className="page-metas__card-name">{meta.nome}</h3>
          {meta.prazo && <span className="page-metas__card-prazo">até {formatPrazoBr(meta.prazo)}</span>}
        </div>
        <div className="page-metas__card-menu-wrap">
          <button type="button" className="page-metas__card-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Opções">⋯</button>
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

      <div className="page-metas__bar" aria-hidden>
        <span className="page-metas__bar-fill" style={{ width: `${progresso}%` }} />
      </div>

      <div className="page-metas__card-values">
        <span className="page-metas__card-guardado">{formatCurrencyBRL(guardado)}</span>
        <span className="page-metas__card-alvo">de {formatCurrencyBRL(alvo)}</span>
        <span className="page-metas__card-pct">{progresso}%</span>
      </div>

      <p className="page-metas__card-status">
        {concluida ? (
          <span className="page-metas__done-tag">✓ Meta concluída!</span>
        ) : porMes ? (
          <>Guarde <strong>{formatCurrencyBRL(porMes)}/mês</strong> pra chegar lá</>
        ) : (
          <>Faltam <strong>{formatCurrencyBRL(falta)}</strong></>
        )}
      </p>

      {!concluida && (
        <button type="button" className="page-metas__card-cta" onClick={() => onGuardar(meta)}>Guardar valor</button>
      )}
      {concluida && (
        <button type="button" className="page-metas__card-cta page-metas__card-cta--ghost" onClick={() => onGuardar(meta)}>Ajustar valor</button>
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

  const pessoalParam = isMembroConta && escopo === 'pessoal' ? '?pessoal=1' : ''

  const carregar = useCallback(async (pp = pessoalParam) => {
    setLoading(true)
    try {
      const res = await apiFetch(apiUrl(`/api/metas${pp}`), { cache: 'no-store' })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
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

  const totais = useMemo(() => {
    const alvo = metas.reduce((s, m) => s + (Number(m.valor_alvo) || 0), 0)
    const guardado = metas.reduce((s, m) => s + (Number(m.valor_guardado) || 0), 0)
    return { alvo, guardado, qtd: metas.length }
  }, [metas])

  async function salvarMeta(payload) {
    setSalvando(true)
    try {
      const url = metaEdit ? `/api/metas/${metaEdit.id}${pessoalParam}` : `/api/metas${pessoalParam}`
      const res = await apiFetch(apiUrl(url), {
        method: metaEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
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
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
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
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
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
            <RefDashboardScroll>
              <section className="dashboard-hub__hero" aria-label="Metas">
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                  <div className="dashboard-hub__hero-text">
                    <h1 className="dashboard-hub__title">Metas</h1>
                    <div className="dashboard-hub__balance-line" aria-live="polite">
                      <span>
                        {loading
                          ? 'Carregando…'
                          : totais.qtd === 0
                            ? 'Nenhuma meta ainda'
                            : `${formatCurrencyBRL(totais.guardado)} guardados de ${formatCurrencyBRL(totais.alvo)}`}
                      </span>
                    </div>
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
                    <button type="button" className={`page-metas__escopo-btn${escopo === 'familia' ? ' page-metas__escopo-btn--active' : ''}`} onClick={() => setEscopo('familia')}>👨‍👩‍👧 Família</button>
                    <button type="button" className={`page-metas__escopo-btn${escopo === 'pessoal' ? ' page-metas__escopo-btn--active' : ''}`} onClick={() => setEscopo('pessoal')}>👤 Pessoal</button>
                  </div>
                )}

                {loading ? (
                  <p className="page-metas__loading">Carregando suas metas…</p>
                ) : metas.length === 0 ? (
                  <div className="page-metas__empty">
                    <span className="page-metas__empty-icon">🎯</span>
                    <h2 className="page-metas__empty-title">Crie sua primeira meta</h2>
                    <p className="page-metas__empty-desc">Junte dinheiro pra uma viagem, uma reserva de emergência ou aquele sonho. Acompanhe o progresso e guarde no seu ritmo.</p>
                    <button type="button" className="page-metas__empty-btn" onClick={() => { setMetaEdit(null); setModalMeta(true) }}>+ Criar meta</button>
                  </div>
                ) : (
                  <div className="page-metas__grid">
                    {metas.map((m) => (
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
              </section>
            </RefDashboardScroll>
          </div>
        </main>
      </div>

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

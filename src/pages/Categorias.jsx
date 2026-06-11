import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './dashboard.css'
import '../styles/pages/categorias.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { TransacaoCategoriaIcon } from '../components/TransacaoCategoriaIcon.jsx'
import { useFabCompact } from '../hooks/useFabCompact'
import { showToast } from '../lib/toastStore'
import { fetchCategorias } from '../lib/apiCategorias'
import {
  criarCategoria, atualizarCategoria, removerCategoria, fundirCategoria,
  criarSubcategoria, atualizarSubcategoria, removerSubcategoria,
  getUsoCategorias, listarSubcategoriasArquivadas, restaurarSubcategoria, podarSubcategoriasSemUso,
  ICONES_CATEGORIA, CORES_CATEGORIA,
} from '../lib/apiCategoriasCrud'

// Ícone da categoria: usa o escolhido (icone) ou cai na resolução por nome.
function CategoriaIcone({ categoria, size = 22 }) {
  if (categoria?.icone) {
    return (
      <img
        src={`/icons/categorias/${categoria.icone}.png`}
        width={size} height={size} alt="" loading="lazy" draggable={false}
        style={{ display: 'block', objectFit: 'contain' }} aria-hidden="true"
      />
    )
  }
  return <TransacaoCategoriaIcon categoriaNome={categoria?.nome} isReceita={categoria?.tipo === 'RECEITA'} size={size} />
}

function IconBtn({ label, onClick, children }) {
  return (
    <button type="button" className="page-categorias__act" onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  )
}
const SvgEdit = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
const SvgMerge = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3v6a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" /><path d="M12 15v6" /></svg>
const SvgTrash = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></svg>
const SvgPlus = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
const SvgChevron = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>

// ── Modal: criar / editar categoria ─────────────────────────────────────────
function CategoriaModal({ categoria, onClose, onSaved }) {
  const editando = !!categoria
  const [nome, setNome] = useState(categoria?.nome || '')
  const [tipo, setTipo] = useState(categoria?.tipo || 'DESPESA')
  const [cor, setCor] = useState(categoria?.cor || CORES_CATEGORIA[12])
  const [icone, setIcone] = useState(categoria?.icone || null)
  const [salvando, setSalvando] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!nome.trim()) { showToast('Dê um nome à categoria.', 'warning'); return }
    setSalvando(true)
    try {
      if (editando) await atualizarCategoria(categoria.id, { nome, cor, icone })
      else await criarCategoria({ nome, tipo, cor, icone })
      showToast(editando ? 'Categoria atualizada.' : 'Categoria criada.', 'success')
      onSaved()
    } catch (err) {
      showToast(err.message || 'Não foi possível salvar.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="page-categorias__overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-categorias__modal" role="dialog" aria-modal="true" aria-label={editando ? 'Editar categoria' : 'Nova categoria'}>
        <div className="page-categorias__modal-head">
          <h2 className="page-categorias__modal-title">{editando ? 'Editar categoria' : 'Nova categoria'}</h2>
          <button type="button" className="page-categorias__modal-close" onClick={onClose} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
          </button>
        </div>
        <form onSubmit={submit} className="page-categorias__modal-body">
          <label className="page-categorias__field">
            <span className="page-categorias__label">Nome</span>
            <input className="page-categorias__input" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} autoFocus placeholder="Ex.: Alimentação" />
          </label>

          {!editando && (
            <div className="page-categorias__field">
              <span className="page-categorias__label">Tipo</span>
              <div className="page-categorias__tipo">
                <button type="button" className={`page-categorias__tipo-btn${tipo === 'DESPESA' ? ' is-active' : ''}`} onClick={() => setTipo('DESPESA')}>Despesa</button>
                <button type="button" className={`page-categorias__tipo-btn${tipo === 'RECEITA' ? ' is-active' : ''}`} onClick={() => setTipo('RECEITA')}>Receita</button>
              </div>
            </div>
          )}

          <div className="page-categorias__field">
            <span className="page-categorias__label">Cor</span>
            <div className="page-categorias__cor-grid">
              {CORES_CATEGORIA.map((c) => (
                <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setCor(c)}
                  className={`page-categorias__cor-opt${cor === c ? ' is-active' : ''}`} style={{ background: c }} />
              ))}
            </div>
          </div>

          <div className="page-categorias__field">
            <span className="page-categorias__label">Ícone</span>
            <div className="page-categorias__icon-grid">
              <button type="button" onClick={() => setIcone(null)} title="Automático"
                className={`page-categorias__icon-opt${icone == null ? ' is-active' : ''}`}>
                <TransacaoCategoriaIcon categoriaNome={nome} isReceita={tipo === 'RECEITA'} size={22} />
              </button>
              {ICONES_CATEGORIA.map((ic) => (
                <button key={ic} type="button" onClick={() => setIcone(ic)} title={ic}
                  className={`page-categorias__icon-opt${icone === ic ? ' is-active' : ''}`}>
                  <img src={`/icons/categorias/${ic}.png`} width={22} height={22} alt="" loading="lazy" draggable={false} />
                </button>
              ))}
            </div>
          </div>

          <div className="page-categorias__modal-actions">
            <button type="button" className="page-categorias__btn page-categorias__btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="page-categorias__btn page-categorias__btn--primary" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal: criar / editar subcategoria ──────────────────────────────────────
function SubcategoriaModal({ categoriaId, sub, onClose, onSaved }) {
  const editando = !!sub
  const [nome, setNome] = useState(sub?.nome || '')
  const [salvando, setSalvando] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!nome.trim()) { showToast('Dê um nome à subcategoria.', 'warning'); return }
    setSalvando(true)
    try {
      if (editando) await atualizarSubcategoria(sub.id, { nome })
      else await criarSubcategoria(categoriaId, { nome })
      showToast(editando ? 'Subcategoria atualizada.' : 'Subcategoria criada.', 'success')
      onSaved()
    } catch (err) {
      showToast(err.message || 'Não foi possível salvar.', 'error')
    } finally {
      setSalvando(false)
    }
  }
  return (
    <div className="page-categorias__overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-categorias__modal page-categorias__modal--sm" role="dialog" aria-modal="true" aria-label={editando ? 'Editar subcategoria' : 'Nova subcategoria'}>
        <div className="page-categorias__modal-head">
          <h2 className="page-categorias__modal-title">{editando ? 'Editar subcategoria' : 'Nova subcategoria'}</h2>
          <button type="button" className="page-categorias__modal-close" onClick={onClose} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
          </button>
        </div>
        <form onSubmit={submit} className="page-categorias__modal-body">
          <label className="page-categorias__field">
            <span className="page-categorias__label">Nome</span>
            <input className="page-categorias__input" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} autoFocus />
          </label>
          <div className="page-categorias__modal-actions">
            <button type="button" className="page-categorias__btn page-categorias__btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="page-categorias__btn page-categorias__btn--primary" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal: fundir categoria ─────────────────────────────────────────────────
function FundirModal({ origem, candidatos, onClose, onSaved }) {
  const [destino, setDestino] = useState('')
  const [salvando, setSalvando] = useState(false)
  const submit = async () => {
    if (!destino) { showToast('Escolha a categoria de destino.', 'warning'); return }
    setSalvando(true)
    try {
      await fundirCategoria(origem.id, destino)
      showToast('Categorias fundidas. As transações foram movidas.', 'success')
      onSaved()
    } catch (err) {
      showToast(err.message || 'Não foi possível fundir.', 'error')
    } finally {
      setSalvando(false)
    }
  }
  return (
    <div className="page-categorias__overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-categorias__modal page-categorias__modal--sm" role="dialog" aria-modal="true" aria-label="Fundir categoria">
        <div className="page-categorias__modal-head">
          <h2 className="page-categorias__modal-title">Fundir “{origem.nome}”</h2>
          <button type="button" className="page-categorias__modal-close" onClick={onClose} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
          </button>
        </div>
        <div className="page-categorias__modal-body">
          <p className="page-categorias__hint">
            Todas as transações de <strong>{origem.nome}</strong> serão movidas para a categoria escolhida, e <strong>{origem.nome}</strong> será arquivada. A subcategoria das transações movidas é limpa.
          </p>
          <label className="page-categorias__field">
            <span className="page-categorias__label">Mover para</span>
            <select className="page-categorias__input" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Selecione…</option>
              {candidatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          {candidatos.length === 0 && (
            <p className="page-categorias__hint">Não há outra categoria de {origem.tipo === 'RECEITA' ? 'receita' : 'despesa'} pra fundir.</p>
          )}
          <div className="page-categorias__modal-actions">
            <button type="button" className="page-categorias__btn page-categorias__btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="page-categorias__btn page-categorias__btn--primary" onClick={submit} disabled={salvando || !destino}>
              {salvando ? 'Fundindo…' : 'Fundir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Linha de categoria ──────────────────────────────────────────────────────
function CategoriaRow({ cat, usoSub, onEdit, onMerge, onRemove, onPrune, onAddSub, onEditSub, onRemoveSub, onReload }) {
  const [aberto, setAberto] = useState(false)
  const [arquivadas, setArquivadas] = useState(null) // null=não carregou; []=carregou vazio
  const [verArquivadas, setVerArquivadas] = useState(false)
  const subs = cat.subcategorias || []
  const usoDe = (id) => (usoSub && usoSub[id]) || 0
  const semUso = subs.filter((s) => usoDe(s.id) === 0).length

  const toggleArquivadas = async () => {
    const novo = !verArquivadas
    setVerArquivadas(novo)
    if (novo && arquivadas == null) {
      const data = await listarSubcategoriasArquivadas(cat.id)
      setArquivadas(Array.isArray(data) ? data : [])
    }
  }
  const restaurar = async (sub) => {
    try {
      await restaurarSubcategoria(sub.id)
      showToast('Subcategoria restaurada.', 'success')
      setArquivadas((prev) => (prev || []).filter((s) => s.id !== sub.id))
      onReload()
    } catch (err) {
      showToast(err.message || 'Não foi possível restaurar.', 'error')
    }
  }

  return (
    <div className="page-categorias__cat">
      <div className="page-categorias__cat-head">
        <span className="page-categorias__cat-icon" style={{ '--cat-cor': cat.cor || '#94a3b8' }}>
          <CategoriaIcone categoria={cat} size={22} />
        </span>
        <button type="button" className="page-categorias__cat-name" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
          <span className="page-categorias__cat-title">{cat.nome}</span>
          <span className="page-categorias__cat-count">
            {subs.length} {subs.length === 1 ? 'subcategoria' : 'subcategorias'}
            {semUso > 0 && <span className="page-categorias__cat-flag"> · {semUso} sem uso</span>}
          </span>
        </button>
        <div className="page-categorias__cat-acts">
          <IconBtn label="Editar" onClick={() => onEdit(cat)}>{SvgEdit}</IconBtn>
          <IconBtn label="Fundir" onClick={() => onMerge(cat)}>{SvgMerge}</IconBtn>
          <IconBtn label="Excluir" onClick={() => onRemove(cat)}>{SvgTrash}</IconBtn>
          <button type="button" className={`page-categorias__act page-categorias__chevron${aberto ? ' is-open' : ''}`} onClick={() => setAberto((v) => !v)} aria-label={aberto ? 'Recolher' : 'Expandir'}>
            {SvgChevron}
          </button>
        </div>
      </div>
      {aberto && (
        <div className="page-categorias__subs">
          {semUso > 0 && (
            <button type="button" className="page-categorias__prune" onClick={() => onPrune(cat, semUso)}>
              Ocultar {semUso} {semUso === 1 ? 'subcategoria sem uso' : 'subcategorias sem uso'}
            </button>
          )}
          {subs.map((s) => {
            const n = usoDe(s.id)
            return (
              <div key={s.id} className={`page-categorias__sub${n === 0 ? ' is-unused' : ''}`}>
                <span className="page-categorias__sub-name">{s.nome}</span>
                <span className="page-categorias__sub-uso">{n > 0 ? `${n}×` : 'sem uso'}</span>
                <div className="page-categorias__sub-acts">
                  <IconBtn label="Editar subcategoria" onClick={() => onEditSub(cat, s)}>{SvgEdit}</IconBtn>
                  <IconBtn label="Excluir subcategoria" onClick={() => onRemoveSub(cat, s)}>{SvgTrash}</IconBtn>
                </div>
              </div>
            )
          })}
          <button type="button" className="page-categorias__add-sub" onClick={() => onAddSub(cat)}>
            {SvgPlus} Adicionar subcategoria
          </button>

          <button type="button" className="page-categorias__ver-arquivadas" onClick={toggleArquivadas}>
            {verArquivadas ? 'Ocultar arquivadas' : 'Ver arquivadas'}
          </button>
          {verArquivadas && (
            <div className="page-categorias__arquivadas">
              {arquivadas == null ? (
                <span className="page-categorias__sub-name">Carregando…</span>
              ) : arquivadas.length === 0 ? (
                <span className="page-categorias__sub-name page-categorias__sub-name--muted">Nenhuma subcategoria arquivada.</span>
              ) : arquivadas.map((s) => (
                <div key={s.id} className="page-categorias__sub">
                  <span className="page-categorias__sub-name page-categorias__sub-name--muted">{s.nome}</span>
                  <button type="button" className="page-categorias__restaurar" onClick={() => restaurar(s)}>Restaurar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página ──────────────────────────────────────────────────────────────────
export default function Categorias() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [uso, setUso] = useState({ categorias: {}, subcategorias: {} })
  const [loading, setLoading] = useState(true)
  const fabScrollRef = useRef(null)
  useFabCompact(fabScrollRef)

  // Modais
  const [catModal, setCatModal] = useState(null) // { categoria } | { criar:true }
  const [subModal, setSubModal] = useState(null) // { categoriaId, sub }
  const [fundirModal, setFundirModal] = useState(null) // { origem }
  const [confirmar, setConfirmar] = useState(null) // { tipo:'cat'|'sub'|'prune', ... }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [data, usoData] = await Promise.all([fetchCategorias(), getUsoCategorias()])
      if (data) setCategorias(data)
      if (usoData) setUso(usoData)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const despesas = useMemo(() => categorias.filter((c) => c.tipo === 'DESPESA'), [categorias])
  const receitas = useMemo(() => categorias.filter((c) => c.tipo === 'RECEITA'), [categorias])

  const candidatosFusao = useCallback(
    (origem) => categorias.filter((c) => c.tipo === origem.tipo && c.id !== origem.id),
    [categorias],
  )

  const confirmarRemocao = async () => {
    const alvo = confirmar
    setConfirmar(null)
    try {
      if (alvo.tipo === 'cat') {
        const r = await removerCategoria(alvo.id)
        showToast(r.modo === 'arquivada' ? 'Categoria arquivada (histórico preservado).' : 'Categoria excluída.', 'success')
      } else if (alvo.tipo === 'prune') {
        const r = await podarSubcategoriasSemUso(alvo.id)
        showToast(`${r.arquivadas} ${r.arquivadas === 1 ? 'subcategoria ocultada' : 'subcategorias ocultadas'}. Dá pra restaurar em "Ver arquivadas".`, 'success')
      } else {
        const r = await removerSubcategoria(alvo.id)
        showToast(r.modo === 'arquivada' ? 'Subcategoria arquivada.' : 'Subcategoria excluída.', 'success')
      }
      await carregar()
    } catch (err) {
      showToast(err.message || 'Não foi possível concluir.', 'error')
    }
  }

  const onSaved = () => { setCatModal(null); setSubModal(null); setFundirModal(null); void carregar() }

  const renderGrupo = (titulo, lista) => (
    <section className="page-categorias__grupo" aria-label={titulo}>
      <h2 className="page-categorias__grupo-title">{titulo}</h2>
      {lista.length === 0 ? (
        <p className="page-categorias__empty">Nenhuma categoria de {titulo.toLowerCase()}.</p>
      ) : lista.map((cat) => (
        <CategoriaRow
          key={cat.id} cat={cat}
          usoSub={uso.subcategorias}
          onReload={carregar}
          onEdit={(c) => setCatModal({ categoria: c })}
          onMerge={(c) => setFundirModal({ origem: c })}
          onRemove={(c) => setConfirmar({ tipo: 'cat', id: c.id, nome: c.nome })}
          onPrune={(c, n) => setConfirmar({ tipo: 'prune', id: c.id, nome: c.nome, count: n })}
          onAddSub={(c) => setSubModal({ categoriaId: c.id, sub: null })}
          onEditSub={(c, s) => setSubModal({ categoriaId: c.id, sub: s })}
          onRemoveSub={(c, s) => setConfirmar({ tipo: 'sub', id: s.id, nome: s.nome })}
        />
      ))}
    </section>
  )

  return (
    <div className="dashboard-container dashboard-page page-categorias ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />
        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll ref={fabScrollRef}>
              <section className="dashboard-hub__hero" aria-label="Categorias">
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                  <div className="dashboard-hub__hero-text">
                    <h1 className="dashboard-hub__title">Categorias</h1>
                  </div>
                  <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Ações">
                    <button type="button" className="dashboard-hub__btn dashboard-hub__btn--primary" onClick={() => setCatModal({ categoria: null })}>
                      + Nova categoria
                    </button>
                  </div>
                </div>
              </section>

              <section className="ref-bottom-grid ref-bottom-grid--single page-categorias-panel" aria-label="Suas categorias">
                {loading ? (
                  <p className="page-categorias__empty">Carregando…</p>
                ) : (
                  <>
                    {renderGrupo('Despesas', despesas)}
                    {renderGrupo('Receitas', receitas)}
                  </>
                )}
              </section>
            </RefDashboardScroll>
          </div>
        </main>
      </div>

      {catModal && (
        <CategoriaModal categoria={catModal.categoria} onClose={() => setCatModal(null)} onSaved={onSaved} />
      )}
      {subModal && (
        <SubcategoriaModal categoriaId={subModal.categoriaId} sub={subModal.sub} onClose={() => setSubModal(null)} onSaved={onSaved} />
      )}
      {fundirModal && (
        <FundirModal origem={fundirModal.origem} candidatos={candidatosFusao(fundirModal.origem)} onClose={() => setFundirModal(null)} onSaved={onSaved} />
      )}
      {confirmar && (
        <ConfirmDialog
          open
          title={
            confirmar.tipo === 'cat' ? 'Excluir categoria?'
              : confirmar.tipo === 'prune' ? 'Ocultar subcategorias sem uso?'
                : 'Excluir subcategoria?'
          }
          message={
            confirmar.tipo === 'cat'
              ? `"${confirmar.nome}" será arquivada se tiver transações (histórico preservado) ou excluída se estiver vazia.`
              : confirmar.tipo === 'prune'
                ? `As ${confirmar.count} subcategorias de "${confirmar.nome}" sem nenhuma transação serão ocultadas. Você pode restaurá-las depois em "Ver arquivadas".`
                : `"${confirmar.nome}" será arquivada se estiver em uso ou excluída se não.`
          }
          confirmLabel={confirmar.tipo === 'prune' ? 'Ocultar' : 'Remover'}
          onConfirm={confirmarRemocao}
          onClose={() => setConfirmar(null)}
        />
      )}
    </div>
  )
}

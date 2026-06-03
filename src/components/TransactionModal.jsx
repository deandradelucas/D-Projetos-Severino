import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import CategorySelector from './transaction/CategorySelector'
import { useTransactionForm } from '../hooks/useTransactionForm'
import { useModalA11y } from '../hooks/useModalA11y'

function tipoCategoriaIgual(tipoCampo, tipoAlvo) {
  return String(tipoCampo ?? '').trim().toUpperCase() === String(tipoAlvo ?? '').trim().toUpperCase()
}

const ParcelamentoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M2 10h20" stroke="currentColor" strokeWidth="2"/>
    <path d="M6 15h4M14 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export default function TransactionModal({ isOpen, onClose, onSave, usuarioId, editingTransaction = null }) {
  const [categorias, setCategorias] = useState([])
  const [cartoes, setCartoes] = useState([])
  const [loadingCats, setLoadingCats] = useState(false)
  const [activeSelect, setActiveSelect] = useState(null)
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [aiSuggestedCat, setAiSuggestedCat] = useState(false)
  // Pacote 2 — validação visual + dirty tracking
  const [validationAttempted, setValidationAttempted] = useState(false)
  const initialFormRef = useRef(null)

  const valorInputRef = useRef(null)
  const modalSheetRef = useRef(null)
  const suggestTimeoutRef = useRef(null)

  const scrollValorIntoView = useCallback(() => {
    const el = valorInputRef.current
    if (!el) return
    requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
    window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320)
  }, [])

  const fetchCategorias = useCallback(async () => {
    setLoadingCats(true)
    try {
      const res = await apiFetch(apiUrl('/api/categorias'), {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setCategorias(data || [])
      }
    } catch {
      // Erros de rede não são fatais — modal permanece funcional
    } finally {
      setLoadingCats(false)
    }
  }, [])

  const {
    formData,
    setFormData,
    displayValor,
    saving,
    isEditMode,
    initForm,
    handleChange,
    handleTypeChange,
    handleCurrencyChange,
    setDateShortcut,
    handleSubmit,
  } = useTransactionForm({ usuarioId, editingTransaction, isOpen, onSave, onClose })

  const { titleId } = useModalA11y({
    open: isOpen,
    onClose,
    containerRef: modalSheetRef,
    blockClose: saving,
  })

  const handleBackdropMouseDown = useCallback((event) => {
    if (event.target === event.currentTarget && !saving) {
      // Usa o close seguro (confirma se há mudanças)
      const tryClose = onCloseSafeRef.current
      if (typeof tryClose === 'function') tryClose()
      else onClose()
    }
  }, [onClose, saving])
  const onCloseSafeRef = useRef(null)
  const isDirtyRef = useRef(false)

  // Inicializa o formulário e busca categorias ao abrir
  useEffect(() => {
    if (!isOpen || !usuarioId) return
    fetchCategorias()
    initForm()
    setAiSuggestedCat(false)
    setValidationAttempted(false)
    // Captura snapshot inicial para detectar dirty
    initialFormRef.current = null
    // Auto-focus no valor após pequeno delay (deixa o modal renderizar)
    const focusTimer = setTimeout(() => {
      const el = valorInputRef.current
      if (el && typeof window !== 'undefined' && window.matchMedia('(min-width: 769px)').matches) {
        try { el.focus({ preventScroll: false }) } catch { el.focus() }
      }
    }, 80)
    return () => clearTimeout(focusTimer)
  }, [isOpen, usuarioId, editingTransaction?.id, fetchCategorias, initForm])

  // Cartões do usuário (para vincular despesa a uma fatura)
  useEffect(() => {
    if (!isOpen) return undefined
    let cancel = false
    apiFetch(apiUrl('/api/cartoes'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (!cancel) setCartoes(Array.isArray(d) ? d : []) })
      .catch(() => {})
    return () => { cancel = true }
  }, [isOpen])

  // Captura snapshot do form quando inicializado (primeira render após initForm)
  useEffect(() => {
    if (!isOpen) return
    if (initialFormRef.current === null && formData) {
      initialFormRef.current = JSON.stringify({
        tipo: formData.tipo,
        categoria_id: formData.categoria_id,
        subcategoria_id: formData.subcategoria_id,
        descricao: formData.descricao,
        valor: formData.valor,
        data_transacao: formData.data_transacao,
      })
    }
  }, [isOpen, formData])

  const isDirty = useMemo(() => {
    if (!initialFormRef.current || !formData) return false
    const snap = JSON.stringify({
      tipo: formData.tipo,
      categoria_id: formData.categoria_id,
      subcategoria_id: formData.subcategoria_id,
      descricao: formData.descricao,
      valor: formData.valor,
      data_transacao: formData.data_transacao,
    })
    return snap !== initialFormRef.current
  }, [formData])

  // Wrap onClose para confirmar descarte se dirty
  const onCloseSafe = useCallback(() => {
    if (saving) return
    if (isDirty) {
      const ok = window.confirm('Descartar as mudanças?')
      if (!ok) return
    }
    onClose()
  }, [saving, isDirty, onClose])

  // Mantém ref atualizada para o handleBackdropMouseDown
  useEffect(() => { onCloseSafeRef.current = onCloseSafe }, [onCloseSafe])
  useEffect(() => { isDirtyRef.current = isDirty }, [isDirty])

  // Wrap handleSubmit para marcar validação visual + persistir template
  const handleSubmitWithValidation = useCallback((e) => {
    e.preventDefault?.()
    setValidationAttempted(true)
    // Persiste template (R) — top 3 mais usados em localStorage
    try {
      if (!isEditMode && formData?.descricao && formData?.categoria_id) {
        const key = 'ntx_recent_templates_v1'
        const raw = localStorage.getItem(key)
        const list = raw ? JSON.parse(raw) : []
        const tmpl = {
          tipo: formData.tipo,
          categoria_id: formData.categoria_id,
          subcategoria_id: formData.subcategoria_id || '',
          descricao: String(formData.descricao).trim().slice(0, 30),
        }
        const dedup = list.filter((t) => t.descricao !== tmpl.descricao)
        dedup.unshift(tmpl)
        localStorage.setItem(key, JSON.stringify(dedup.slice(0, 6)))
      }
    } catch {
      // ignora — localStorage pode estar bloqueado
    }
    return handleSubmit(e)
  }, [handleSubmit, formData, isEditMode])

  // (R) Templates rápidos — top 3 do localStorage
  const [recentTemplates, setRecentTemplates] = useState([])
  useEffect(() => {
    if (!isOpen || isEditMode) { setRecentTemplates([]); return }
    try {
      const raw = localStorage.getItem('ntx_recent_templates_v1')
      const list = raw ? JSON.parse(raw) : []
      setRecentTemplates(Array.isArray(list) ? list.slice(0, 3) : [])
    } catch {
      setRecentTemplates([])
    }
  }, [isOpen, isEditMode])
  const applyTemplate = useCallback((tmpl) => {
    setFormData((prev) => ({
      ...prev,
      tipo: tmpl.tipo || prev.tipo,
      categoria_id: tmpl.categoria_id || prev.categoria_id,
      subcategoria_id: tmpl.subcategoria_id || '',
      descricao: tmpl.descricao || prev.descricao,
    }))
    // Foca valor depois de aplicar
    setTimeout(() => valorInputRef.current?.focus(), 60)
  }, [setFormData])

  // (Q) Calculadora inline
  const [calcOpen, setCalcOpen] = useState(false)
  const [calcExpr, setCalcExpr] = useState('')
  const calcInputRef = useRef(null)
  useEffect(() => {
    if (calcOpen) setTimeout(() => calcInputRef.current?.focus(), 40)
  }, [calcOpen])
  const safeEvalExpression = (expr) => {
    // Aceita apenas: dígitos, espaços, + - * / ( ) . ,
    if (!/^[\d\s+\-*/().,]+$/.test(expr)) return null
    // Converte vírgula → ponto (notação BR)
    const norm = expr.replace(/,/g, '.')
    try {
      const fn = new Function(`"use strict"; return (${norm});`)
      const val = fn()
      if (typeof val !== 'number' || !Number.isFinite(val)) return null
      return Math.round(val * 100) / 100
    } catch {
      return null
    }
  }
  const handleCalcSubmit = useCallback(() => {
    const result = safeEvalExpression(calcExpr)
    if (result == null) return
    const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(result)
    handleCurrencyChange({ target: { name: 'valorDisplay', value: brl } })
    setCalcOpen(false)
    setCalcExpr('')
    setTimeout(() => valorInputRef.current?.focus(), 40)
  }, [calcExpr, handleCurrencyChange])

  // Limpa timeout ao fechar modal
  useEffect(() => {
    if (!isOpen && suggestTimeoutRef.current) {
      clearTimeout(suggestTimeoutRef.current)
    }
  }, [isOpen])

  // Ajuste dinâmico para teclado virtual (mobile)
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const sheet = modalSheetRef.current
    const update = () => {
      if (!sheet) return
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      sheet.style.setProperty('--keyboard-overlap', `${overlap}px`)
    }
    update()
    vv.addEventListener('resize', update, { passive: true })
    vv.addEventListener('scroll', update, { passive: true })
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      sheet?.style.removeProperty('--keyboard-overlap')
    }
  }, [isOpen])

  // Mobile: arrastar o sheet pra baixo (a partir do topo) fecha o modal
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined
    if (!window.matchMedia('(max-width: 768px)').matches) return undefined
    const sheet = modalSheetRef.current
    if (!sheet) return undefined
    let startY = 0
    let active = false
    let decided = false
    let dy = 0
    const setDrag = (px) => sheet.style.setProperty('--ntx-drag', `${px}px`)
    const onStart = (e) => {
      if (e.touches.length !== 1) return
      startY = e.touches[0].clientY
      active = sheet.scrollTop <= 0
      decided = false
      dy = 0
    }
    const onMove = (e) => {
      if (!active) return
      dy = e.touches[0].clientY - startY
      if (!decided) {
        if (Math.abs(dy) < 6) return
        // só dismiss se arrastar PRA BAIXO a partir do topo
        if (dy < 0 || sheet.scrollTop > 0) { active = false; return }
        decided = true
        sheet.classList.add('ntx-dragging')
      }
      if (dy > 0) {
        if (e.cancelable) e.preventDefault()
        setDrag(dy)
      }
    }
    // Anima --ntx-drag até `target` (com transição) e chama `after` no fim
    const animateTo = (target, after) => {
      sheet.classList.remove('ntx-dragging')
      sheet.classList.add('ntx-closing')
      requestAnimationFrame(() => {
        setDrag(target)
        window.setTimeout(after, 300)
      })
    }
    const finish = () => {
      if (!active || !decided) { active = false; return }
      active = false
      if (dy > 110) {
        if (isDirtyRef.current) {
          // tem mudanças → confirma antes (sheet segura na posição); volta se cancelar
          onCloseSafe()
          animateTo(0, () => sheet.classList.remove('ntx-closing'))
        } else {
          // desliza pra fora e fecha
          animateTo(window.innerHeight, () => onCloseSafe())
        }
      } else {
        // não passou do limite → volta suave
        animateTo(0, () => sheet.classList.remove('ntx-closing'))
      }
    }
    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', finish, { passive: true })
    sheet.addEventListener('touchcancel', finish, { passive: true })
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', finish)
      sheet.removeEventListener('touchcancel', finish)
      sheet.classList.remove('ntx-dragging', 'ntx-closing')
      sheet.style.removeProperty('--ntx-drag')
    }
  }, [isOpen, onCloseSafe])

  // Sugestão de categoria por IA — debounce 600ms na descrição
  useEffect(() => {
    if (!isOpen || !usuarioId || isEditMode) return

    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)

    const desc = formData.descricao.trim()

    // Não sugere se descrição curta ou categoria já definida manualmente
    if (desc.length < 3 || formData.categoria_id) return

    suggestTimeoutRef.current = setTimeout(async () => {
      setAiSuggesting(true)
      try {
        const res = await apiFetch(apiUrl('/api/ai/suggest-category'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descricao: desc, tipo: formData.tipo }),
        })
        if (!res.ok) return
        const { categoria_id, subcategoria_id } = await res.json()
        if (!categoria_id) return

        setFormData((prev) => {
          // Dupla verificação: não sobrescreve se usuário selecionou no intervalo
          if (prev.categoria_id) return prev
          return { ...prev, categoria_id, subcategoria_id: subcategoria_id || '' }
        })
        setAiSuggestedCat(true)
      } catch {
        // Falha silenciosa — sugestão é best-effort
      } finally {
        setAiSuggesting(false)
      }
    }, 600)

    return () => {
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
    }
  }, [formData.descricao, formData.tipo, formData.categoria_id, isOpen, isEditMode, usuarioId, setFormData])

  // Reseta badge ao trocar tipo
  const handleTypeChangeWithReset = useCallback((newType) => {
    setAiSuggestedCat(false)
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
    handleTypeChange(newType)
  }, [handleTypeChange])

  // Reseta badge quando usuário altera categoria manualmente
  const handleChangeWithAIReset = useCallback((e) => {
    if (e.target.name === 'categoria_id') setAiSuggestedCat(false)
    handleChange(e)
  }, [handleChange])

  const categoriasFiltradas = useMemo(
    () =>
      [...categorias]
        .filter((c) => tipoCategoriaIgual(c.tipo, formData.tipo))
        .sort((a, b) =>
          String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt', { sensitivity: 'base' })
        ),
    [categorias, formData.tipo]
  )

  if (!isOpen) return null

  const selectedCategoria = categorias.find((c) => String(c.id) === String(formData.categoria_id))
  const subcategorias = selectedCategoria ? selectedCategoria.subcategorias : []

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className="modal-content modal-content--nova-tx"
        ref={modalSheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header modal-header--minimal">
          <h3 id={titleId} className="sr-only">{isEditMode ? 'Editar Transação' : 'Nova Transação'}</h3>
          <button type="button" onClick={onCloseSafe} className="close-btn" aria-label="Fechar" disabled={saving}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmitWithValidation} className={`modal-form modal-form--sheet${validationAttempted ? ' modal-form--validated' : ''}`}>
          <div className="modal-body modal-body--nova-tx">

            {/* (R) Templates rápidos */}
            {!isEditMode && recentTemplates.length > 0 && (
              <div className="ntx-templates" role="toolbar" aria-label="Templates rápidos">
                <span className="ntx-templates__label">Recentes</span>
                {recentTemplates.map((tmpl, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`ntx-template-chip ntx-template-chip--${(tmpl.tipo || 'DESPESA').toLowerCase()}`}
                    onClick={() => applyTemplate(tmpl)}
                    title={`Preencher com: ${tmpl.descricao}`}
                  >
                    {tmpl.descricao}
                  </button>
                ))}
              </div>
            )}

            {/* ── Seção: Classificação ── */}
            <section className="nova-tx-section" aria-labelledby="nova-tx-h-classif">
              <h4 id="nova-tx-h-classif" className="nova-tx-section__title">Classificação</h4>

              <div className="form-group">
                <label>Tipo</label>
                <div className="type-toggle">
                  <button
                    type="button"
                    className={`type-btn despesa ${formData.tipo === 'DESPESA' ? 'active' : ''}`}
                    onClick={() => handleTypeChangeWithReset('DESPESA')}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    data-tutorial-id="tipo-receita-btn"
                    className={`type-btn receita ${formData.tipo === 'RECEITA' ? 'active' : ''}`}
                    onClick={() => handleTypeChangeWithReset('RECEITA')}
                  >
                    Receita
                  </button>
                </div>
              </div>

              <div data-tutorial-id="categoria-selector" className="form-group" style={{ opacity: loadingCats ? 0.5 : 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Categoria
                  {aiSuggesting && (
                    <svg
                      className="spinner"
                      viewBox="0 0 24 24"
                      style={{ width: '13px', height: '13px', opacity: 0.5 }}
                      aria-label="IA analisando..."
                    >
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
                    </svg>
                  )}
                </label>
                <CategorySelector
                  name="categoria_id"
                  value={formData.categoria_id}
                  onChange={handleChangeWithAIReset}
                  options={categoriasFiltradas}
                  placeholder="Escolha uma categoria…"
                  isOpen={activeSelect === 'categoria_id'}
                  onToggle={setActiveSelect}
                  zIndex={10}
                />
                {aiSuggestedCat && (
                  <span className="ntx-ai-chip" role="status" aria-live="polite">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 3 14.5 8.5 20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z" />
                    </svg>
                    Categoria sugerida pela IA
                  </span>
                )}
              </div>

              {subcategorias.length > 0 && (
                <div data-tutorial-id="subcategoria-selector" className="form-group slide-down">
                  <label>Subcategoria</label>
                  <CategorySelector
                    name="subcategoria_id"
                    value={formData.subcategoria_id}
                    onChange={handleChangeWithAIReset}
                    options={subcategorias}
                    placeholder="Opcional…"
                    isOpen={activeSelect === 'subcategoria_id'}
                    onToggle={setActiveSelect}
                    zIndex={5}
                  />
                </div>
              )}

              {formData.tipo === 'DESPESA' && cartoes.length > 0 && (
                <div className="form-group">
                  <label htmlFor="tx-cartao">
                    Cartão de crédito <span className="modal-label-optional">(opcional)</span>
                  </label>
                  <select
                    id="tx-cartao"
                    name="cartao_id"
                    value={formData.cartao_id || ''}
                    onChange={handleChange}
                    className="input-premium"
                  >
                    <option value="">À vista / sem cartão</option>
                    {cartoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="tx-descricao">
                  Descrição <span className="modal-label-optional">(opcional)</span>
                </label>
                <input
                  id="tx-descricao"
                  type="text"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  placeholder="Ex.: mercado, aluguel, salário…"
                  maxLength={100}
                  className="input-premium"
                />
              </div>
            </section>

            {/* ── Seção: Valor e Data ── */}
            <section className="nova-tx-section">
              <div className="form-group">
                <div className="ntx-valor-label-row">
                  <label htmlFor="tx-valor">Valor (R$)</label>
                  {/* (Q) Calc button */}
                  <button
                    type="button"
                    className={`ntx-calc-toggle${calcOpen ? ' ntx-calc-toggle--open' : ''}`}
                    onClick={() => setCalcOpen((v) => !v)}
                    aria-label="Calculadora"
                    title="Calculadora (ex: 150 + 80,50)"
                    aria-expanded={calcOpen}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="4" y="2" width="16" height="20" rx="2" />
                      <path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
                    </svg>
                  </button>
                </div>
                <input
                  id="tx-valor"
                  data-tutorial-id="tx-valor-input"
                  type="text"
                  name="valorDisplay"
                  value={displayValor}
                  onChange={handleCurrencyChange}
                  ref={valorInputRef}
                  required
                  placeholder="R$ 0,00"
                  autoComplete="off"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onFocus={scrollValorIntoView}
                  className="input-premium input-valor-novo-tx"
                />
                {/* (Q) Calc expression panel */}
                {calcOpen && (
                  <div className="ntx-calc-panel">
                    <input
                      ref={calcInputRef}
                      type="text"
                      className="input-premium ntx-calc-input"
                      placeholder="Ex: 150 + 80,50 * 2"
                      value={calcExpr}
                      onChange={(e) => setCalcExpr(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleCalcSubmit() }
                        if (e.key === 'Escape') { e.preventDefault(); setCalcOpen(false); setCalcExpr('') }
                      }}
                    />
                    <button type="button" className="ntx-calc-eq" onClick={handleCalcSubmit} aria-label="Calcular">
                      =
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group form-group--data-nova-tx">
                <div className="modal-date-toolbar">
                  <label htmlFor="tx-data-transacao">Data e hora</label>
                  <div className="date-shortcuts">
                    <button
                      type="button"
                      className="date-shortcut-btn"
                      onClick={() => setDateShortcut(0)}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      className="date-shortcut-btn"
                      onClick={() => setDateShortcut(1)}
                    >
                      Ontem
                    </button>
                  </div>
                </div>
                <input
                  id="tx-data-transacao"
                  type="datetime-local"
                  name="data_transacao"
                  value={formData.data_transacao}
                  onChange={handleChange}
                  required
                  className="input-premium input-data-novo-tx"
                />
              </div>
            </section>

            {/* ── Parcela atual (só edição de parceladas) ── */}
            {isEditMode && formData.recorrente_index && formData.recorrente_total && (
              <section className="nova-tx-section" aria-label="Parcelamento">
                <h4 className="nova-tx-section__title">Parcelamento</h4>
                <div className="rec-vezes-row">
                  <label htmlFor="tx-edit-parcela" className="rec-vezes-row__label">
                    Parcela
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      id="tx-edit-parcela"
                      type="number"
                      min="1"
                      max={parseInt(formData.recorrente_total, 10)}
                      value={formData.recorrente_index}
                      onChange={(e) => setFormData((prev) => ({ ...prev, recorrente_index: e.target.value }))}
                      className="input-premium rec-vezes-row__input"
                    />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                      / {formData.recorrente_total}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* ── Seção: Parcelamento (só criação) ── */}
            {!isEditMode && (() => {
              const numParcelas = parseInt(formData.num_parcelas, 10)
              const parcelaInicial = Math.max(1, parseInt(formData.parcela_inicial, 10) || 1)
              const numParcelasRestantes = numParcelas - parcelaInicial + 1
              const valorNum = parseFloat(formData.valor)
              const valorParcela = formData.parcelado && numParcelas >= 2 && valorNum > 0
                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                    .format(Math.floor((valorNum / numParcelas) * 100) / 100)
                : null

              return (
                <section
                  className={`nova-tx-section nova-tx-section--parcelamento ${formData.parcelado ? 'nova-tx-section--parcelamento-on' : ''}`}
                  aria-labelledby="nova-tx-h-parcelamento"
                >
                  <h4 id="nova-tx-h-parcelamento" className="nova-tx-section__title">
                    Parcelamento
                  </h4>
                  <div className={`form-group form-group--recorrencia ${formData.parcelado ? 'form-group--recorrencia-on' : ''}`}>
                    <label htmlFor="tx-parcelado" className="modal-recorrencia-toggle-row">
                      <span className="modal-recorrencia-toggle-row__iconWrap" aria-hidden>
                        <ParcelamentoIcon />
                      </span>
                      <span className="modal-recorrencia-toggle-row__text">Compra parcelada</span>
                      {/* (S) Switch neumorphic visual */}
                      <span className={`ntx-switch${formData.parcelado ? ' ntx-switch--on' : ''}`} aria-hidden>
                        <span className="ntx-switch__thumb" />
                      </span>
                      <input
                        id="tx-parcelado"
                        type="checkbox"
                        checked={formData.parcelado}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          parcelado: e.target.checked,
                          prazo_indeterminado: e.target.checked ? prev.prazo_indeterminado : false,
                        }))}
                        className="modal-recorrencia-toggle-row__checkbox modal-recorrencia-toggle-row__checkbox--hidden"
                      />
                    </label>

                    {/* (S) Preview "10× R$ 250 = R$ 2.500" */}
                    {formData.parcelado && !formData.prazo_indeterminado && numParcelas >= 2 && valorNum > 0 && valorParcela && (
                      <div className="ntx-parc-preview" role="status" aria-live="polite">
                        <span className="ntx-parc-preview__count">{numParcelas}×</span>
                        <span className="ntx-parc-preview__value">{valorParcela}</span>
                        <span className="ntx-parc-preview__sep">=</span>
                        <span className="ntx-parc-preview__total">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorNum)}
                        </span>
                      </div>
                    )}

                    {/* (T) Calendário visual das parcelas */}
                    {formData.parcelado && !formData.prazo_indeterminado && numParcelas >= 2 && (
                      (() => {
                        const inicio = formData.data_transacao ? new Date(formData.data_transacao) : new Date()
                        if (Number.isNaN(inicio.getTime())) return null
                        const dia = inicio.getDate()
                        const meses = []
                        for (let i = 0; i < Math.min(numParcelas, 12); i++) {
                          // Cria a data com o mesmo dia da transação. Se o mês não tem aquele dia
                          // (ex: 31/jan → fev), JS rola para o próximo mês — ajustamos para o último dia válido.
                          const targetMonth = inicio.getMonth() + i
                          const tentativa = new Date(inicio.getFullYear(), targetMonth, dia)
                          if (tentativa.getMonth() !== ((targetMonth % 12) + 12) % 12) {
                            // dia inválido nesse mês — usa último dia do mês alvo
                            tentativa.setDate(0)
                          }
                          meses.push({
                            day: tentativa.getDate(),
                            month: tentativa.toLocaleDateString('pt-BR', { month: 'short' }).replace(/\.$/, ''),
                            year: String(tentativa.getFullYear()).slice(-2),
                            idx: i + 1,
                          })
                        }
                        const overflow = numParcelas - meses.length
                        return (
                          <div className="ntx-parc-calendar" aria-label="Linha do tempo das parcelas">
                            {meses.map((m) => (
                              <div
                                key={m.idx}
                                className={`ntx-parc-cell${m.idx === 1 ? ' ntx-parc-cell--first' : ''}${m.idx === numParcelas ? ' ntx-parc-cell--last' : ''}`}
                                title={`${m.idx}ª parcela · ${m.month}/'${m.year}`}
                              >
                                <span className="ntx-parc-cell__idx">{m.idx}ª</span>
                                <span className="ntx-parc-cell__month">{m.month}</span>
                                <span className="ntx-parc-cell__year">'{m.year}</span>
                              </div>
                            ))}
                            {overflow > 0 && (
                              <div className="ntx-parc-cell ntx-parc-cell--overflow" title={`+ ${overflow} mais`}>
                                +{overflow}
                              </div>
                            )}
                          </div>
                        )
                      })()
                    )}

                    {formData.parcelado && (
                      <div className="rec-sub-opts slide-down">
                        {!formData.prazo_indeterminado && (
                          <>
                            <div className="rec-vezes-row">
                              <label htmlFor="tx-num-parcelas" className="rec-vezes-row__label">
                                Total de parcelas
                              </label>
                              <input
                                id="tx-num-parcelas"
                                type="number"
                                min="2"
                                max="120"
                                value={formData.num_parcelas}
                                onChange={(e) => setFormData((prev) => ({ ...prev, num_parcelas: e.target.value, parcela_inicial: '1' }))}
                                className="input-premium rec-vezes-row__input"
                              />
                            </div>
                            <div className="rec-vezes-row">
                              <label htmlFor="tx-parcela-inicial" className="rec-vezes-row__label">
                                Começa na parcela
                              </label>
                              <input
                                id="tx-parcela-inicial"
                                type="number"
                                min="1"
                                max={Math.max(1, numParcelas - 1)}
                                value={formData.parcela_inicial}
                                onChange={(e) => setFormData((prev) => ({ ...prev, parcela_inicial: e.target.value }))}
                                className="input-premium rec-vezes-row__input"
                              />
                            </div>
                          </>
                        )}
                        <label htmlFor="tx-prazo-indeterminado" className="rec-vezes-row rec-vezes-row--toggle">
                          <span className="rec-vezes-row__label">Prazo indeterminado</span>
                          <span className={`ntx-switch${formData.prazo_indeterminado ? ' ntx-switch--on' : ''}`} aria-hidden>
                            <span className="ntx-switch__thumb" />
                          </span>
                          <input
                            id="tx-prazo-indeterminado"
                            type="checkbox"
                            checked={formData.prazo_indeterminado}
                            onChange={(e) => setFormData((prev) => ({ ...prev, prazo_indeterminado: e.target.checked }))}
                            className="modal-recorrencia-toggle-row__checkbox modal-recorrencia-toggle-row__checkbox--hidden"
                          />
                        </label>
                        <div className="rec-vezes-row">
                          <label htmlFor="tx-data-pagamento" className="rec-vezes-row__label">
                            {parcelaInicial > 1 ? `Vencimento da ${parcelaInicial}ª parcela` : 'Data de pagamento'}
                          </label>
                          <input
                            id="tx-data-pagamento"
                            type="date"
                            value={formData.data_pagamento}
                            onChange={(e) => setFormData((prev) => ({ ...prev, data_pagamento: e.target.value }))}
                            className="input-premium rec-vezes-row__input rec-vezes-row__input--date"
                          />
                        </div>
                        <p className="parcelamento-preview parcelamento-preview--hint">
                          {formData.prazo_indeterminado
                            ? 'Assinatura/stream sem fim: desconta esse valor todo mês até cancelar.'
                            : parcelaInicial > 1
                              ? `As parcelas 1 a ${parcelaInicial - 1} já foram pagas e não serão lançadas.`
                              : 'Vencimento da 1ª parcela. Se vazio, usa a data da transação.'}
                        </p>
                        {formData.prazo_indeterminado && valorNum > 0 && (
                          <p className="parcelamento-preview">
                            Mensal · {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorNum)} · sem prazo
                          </p>
                        )}
                        {!formData.prazo_indeterminado && valorParcela && (
                          <p className="parcelamento-preview">
                            {parcelaInicial > 1
                              ? `${numParcelasRestantes} parcelas (${parcelaInicial}/${numParcelas} a ${numParcelas}/${numParcelas}) · ${valorParcela} cada`
                              : `${numParcelas}x de ${valorParcela} · total ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorNum)}`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )
            })()}

          </div>

          <div className="modal-actions">
            <button type="button" onClick={onCloseSafe} className="btn-secondary" disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              data-tutorial-id="salvar-transacao-btn"
              className={`btn-primary ${saving ? 'loading' : ''}`}
              disabled={saving}
            >
              {saving ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <svg className="spinner" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
                  </svg>
                  Salvando...
                </div>
              ) : isEditMode ? (
                'Salvar alterações'
              ) : (
                'Salvar Transação'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import CategorySelector from './transaction/CategorySelector'
import DatePickerBrPopover from './investimentos/DatePickerBrPopover'
import { ymdToDdMmYyyy, todayYmdLocal } from '../lib/dateInputBr'
import { vencimentoCartaoParaData, calcularParcelaAtual } from '../lib/cartaoVencimento'
import { useTransactionForm } from '../hooks/useTransactionForm'
import { useModalA11y } from '../hooks/useModalA11y'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { filtrarCategoriasPorTipo, safeEvalExpression } from '../lib/transacaoFormUtils'

const ParcelamentoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M2 10h20" stroke="currentColor" strokeWidth="2"/>
    <path d="M6 15h4M14 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export default function TransactionModal({ isOpen, onClose, onSave, usuarioId, editingTransaction = null }) {
  const navigate = useNavigate()
  const [categorias, setCategorias] = useState([])
  const [cartoes, setCartoes] = useState([])
  const [loadingCats, setLoadingCats] = useState(false)
  const [activeSelect, setActiveSelect] = useState(null)
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [aiSuggestedCat, setAiSuggestedCat] = useState(false)
  // Pacote 2 — validação visual
  const [validationAttempted, setValidationAttempted] = useState(false)

  // Severino IA — linguagem natural ("gastei 45 com gasolina") autopreenche o form
  const [aiText, setAiText] = useState('')
  const [aiParsing, setAiParsing] = useState(false)

  const valorInputRef = useRef(null)
  const modalSheetRef = useRef(null)
  const suggestTimeoutRef = useRef(null)
  const aiTimeoutRef = useRef(null)

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

  // Inicializa o formulário e busca categorias ao abrir
  useEffect(() => {
    if (!isOpen || !usuarioId) return
    fetchCategorias()
    initForm()
    setAiSuggestedCat(false)
    setValidationAttempted(false)
    setAiText('')
    // Sem auto-focus no campo valor: o foco inicial fica no botão Fechar
    // (via useModalA11y, que foca o primeiro elemento focável). Evita que o
    // cursor caia direto no valor ao abrir o modal — mesmo comportamento no
    // desktop e no mobile.
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

  // Fecha direto (sem confirmar descarte) — apenas bloqueia enquanto salva
  const onCloseSafe = useCallback(() => {
    if (saving) return
    onClose()
  }, [saving, onClose])

  // Mantém ref atualizada para o handleBackdropMouseDown
  useEffect(() => { onCloseSafeRef.current = onCloseSafe }, [onCloseSafe])

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

  // Calendário customizado (visual do sistema) + campo de hora separado
  const [dateCalOpen, setDateCalOpen] = useState(false)
  const dateAnchorRef = useRef(null)
  const setDatePart = useCallback((ymd) => {
    setFormData((prev) => {
      const time = (prev.data_transacao || '').slice(11, 16) || '00:00'
      return { ...prev, data_transacao: `${ymd}T${time}` }
    })
  }, [setFormData])
  const setTimePart = useCallback((e) => {
    const time = e.target.value || '00:00'
    setFormData((prev) => {
      const ymd = (prev.data_transacao || '').slice(0, 10) || todayYmdLocal()
      return { ...prev, data_transacao: `${ymd}T${time}` }
    })
  }, [setFormData])

  // (Q) Calculadora inline (teclado)
  const [calcOpen, setCalcOpen] = useState(false)
  const [calcExpr, setCalcExpr] = useState('')
  const calcRef = useRef(null)
  // Ao abrir a calculadora, rola o teclado para a vista (evita ter que scrollar até ele)
  useEffect(() => {
    if (!calcOpen) return
    const id = window.setTimeout(() => {
      calcRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
    return () => window.clearTimeout(id)
  }, [calcOpen])
  const calcAppend = useCallback((ch) => setCalcExpr((e) => (e + ch).slice(0, 40)), [])
  const calcBackspace = useCallback(() => setCalcExpr((e) => e.slice(0, -1)), [])
  const calcClear = useCallback(() => setCalcExpr(''), [])
  const handleCalcSubmit = useCallback(() => {
    const result = safeEvalExpression(calcExpr)
    if (result == null) return
    const brl = formatCurrencyBRL(result)
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
    // O scroll agora acontece no corpo (header/footer fixos). O drag-to-close só
    // dispara quando o corpo está no topo — senão é scroll normal.
    const scroller = sheet.querySelector('.modal-body--nova-tx')
    const scrollTopOf = () => (scroller ? scroller.scrollTop : sheet.scrollTop)
    let startY = 0
    let active = false
    let decided = false
    let dy = 0
    let rafId = 0
    let pendingDrag = 0
    const writeDrag = () => { rafId = 0; sheet.style.setProperty('--ntx-drag', `${pendingDrag}px`) }
    const setDrag = (px) => {
      pendingDrag = px
      if (!rafId) rafId = requestAnimationFrame(writeDrag)
    }
    const onStart = (e) => {
      if (e.touches.length !== 1) return
      startY = e.touches[0].clientY
      active = scrollTopOf() <= 0
      decided = false
      dy = 0
    }
    const onMove = (e) => {
      if (!active) return
      dy = e.touches[0].clientY - startY
      if (!decided) {
        if (Math.abs(dy) < 6) return
        // só dismiss se arrastar PRA BAIXO a partir do topo
        if (dy < 0 || scrollTopOf() > 0) { active = false; return }
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
        // passou do limite → desliza pra fora e fecha
        animateTo(window.innerHeight, () => onCloseSafe())
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
      if (rafId) cancelAnimationFrame(rafId)
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

  // ─── Severino IA: aplica a transação extraída no formulário ───
  const applyAiTransaction = useCallback((data) => {
    if (data.valor != null && Number(data.valor) > 0) {
      const cents = Math.round(Number(data.valor) * 100)
      handleCurrencyChange({ target: { name: 'valorDisplay', value: String(cents) } })
    }
    setFormData((prev) => {
      const next = { ...prev }
      if (data.tipo === 'DESPESA' || data.tipo === 'RECEITA') next.tipo = data.tipo
      if (data.categoria_id) next.categoria_id = data.categoria_id
      next.subcategoria_id = data.subcategoria_id || ''
      // Descrição fica em branco de propósito — o usuário preenche com o que quiser
      // (ex.: o local da compra). A IA já preencheu tipo/valor/categoria.
      if (data.data_transacao) {
        const d = new Date(data.data_transacao)
        if (!Number.isNaN(d.getTime())) {
          const off = d.getTimezoneOffset() * 60000
          next.data_transacao = new Date(d - off).toISOString().slice(0, 16)
        }
      }
      return next
    })
    if (data.categoria_id) setAiSuggestedCat(true)
  }, [handleCurrencyChange, setFormData])

  // Chama o endpoint de parse e autopreenche (silencioso se não for transação)
  const runAiParse = useCallback(async (texto) => {
    const t = String(texto || '').trim()
    if (t.length < 4) return
    setAiParsing(true)
    try {
      const res = await apiFetch(apiUrl('/api/ai/parse-transaction'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: t }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.tipo === 'DESPESA' || data.tipo === 'RECEITA') applyAiTransaction(data)
      }
    } catch {
      // best-effort: o formulário manual continua funcionando
    } finally {
      setAiParsing(false)
    }
  }, [applyAiTransaction])

  // Debounce 850ms ao digitar no campo IA
  useEffect(() => {
    if (!isOpen || isEditMode) return undefined
    const t = aiText.trim()
    if (t.length < 4) return undefined
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
    aiTimeoutRef.current = setTimeout(() => runAiParse(t), 850)
    return () => { if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current) }
  }, [aiText, isOpen, isEditMode, runAiParse])

  // Com cartão + parcelamento: preenche a data de vencimento da 1ª parcela a partir
  // da data da compra. O backend cria TODAS as parcelas; as já vencidas entram como
  // pagas (histórico). Recalcula ao mudar a data da compra, o cartão ou ligar o
  // parcelamento. Não mexe em parcela_inicial (lança todas por padrão). Só em criação.
  useEffect(() => {
    if (isEditMode || !formData.parcelado) return
    const cartao = cartoes.find((c) => String(c.id) === String(formData.cartao_id))
    if (!cartao) return
    const venc1 = vencimentoCartaoParaData(formData.data_transacao, cartao.dia_vencimento, 0)
    if (!venc1) return
    setFormData((prev) => (prev.data_pagamento === venc1 ? prev : { ...prev, data_pagamento: venc1 }))
  }, [formData.cartao_id, formData.parcelado, formData.data_transacao, cartoes, isEditMode, setFormData])

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
    () => filtrarCategoriasPorTipo(categorias, formData.tipo),
    [categorias, formData.tipo],
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmitWithValidation} className={`modal-form modal-form--sheet${validationAttempted ? ' modal-form--validated' : ''}`}>
          <div className="modal-body modal-body--nova-tx">

            {/* ── Severino IA: linguagem natural autopreenche o form ── */}
            {!isEditMode && (
              <div className="ntx-ai-quick">
                <div className="ntx-ai-quick__head">
                  <span className="ntx-ai-quick__spark" aria-hidden>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3 14.5 8.5 20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z" />
                    </svg>
                  </span>
                  <span className="ntx-ai-quick__title">Severino IA</span>
                  <span className="ntx-ai-quick__sub">descreva e eu preencho</span>
                </div>
                <div className="ntx-ai-quick__field">
                  <input
                    id="tx-ai"
                    type="text"
                    className="input-premium"
                    placeholder="Ex.: gastei 45 com gasolina"
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
                        runAiParse(aiText)
                      }
                    }}
                    autoComplete="off"
                    autoCapitalize="none"
                    enterKeyHint="done"
                    aria-label="Descreva a transação para a IA preencher"
                  />
                  {aiParsing && (
                    <span className="ntx-ai-quick__spin" aria-hidden>
                      <svg className="spinner" viewBox="0 0 24 24" aria-hidden>
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            )}

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

              <div className="form-group form-group--data-nova-tx">
                <div className="modal-date-toolbar">
                  <label htmlFor="tx-data-transacao">
                    {isEditMode && editingTransaction?.recorrente_index ? 'Data de vencimento' : 'Data e hora'}
                  </label>
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
                <div className="ntx-datetime-row">
                  <button
                    id="tx-data-transacao"
                    ref={dateAnchorRef}
                    type="button"
                    className="input-premium input-data-novo-tx ntx-date-trigger"
                    onClick={() => setDateCalOpen((v) => !v)}
                    aria-haspopup="dialog"
                    aria-expanded={dateCalOpen}
                  >
                    <span className="ntx-date-trigger__text">
                      {ymdToDdMmYyyy((formData.data_transacao || '').slice(0, 10)) || 'Selecionar data'}
                    </span>
                    <span className="ntx-date-cal" aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 2v4M16 2v4M3 10h18" />
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                      </svg>
                    </span>
                  </button>
                  <input
                    type="time"
                    name="data_transacao_time"
                    aria-label="Hora"
                    value={(formData.data_transacao || '').slice(11, 16) || '00:00'}
                    onChange={setTimePart}
                    required
                    className="input-premium ntx-time-field"
                  />
                </div>
                <DatePickerBrPopover
                  open={dateCalOpen}
                  onClose={() => setDateCalOpen(false)}
                  anchorRef={dateAnchorRef}
                  valueYmd={(formData.data_transacao || '').slice(0, 10)}
                  onSelectYmd={setDatePart}
                />
                {isEditMode && editingTransaction?.recorrente_index && editingTransaction?.data_compra && (
                  <p className="parcelamento-preview parcelamento-preview--hint">
                    Compra original em {new Date(editingTransaction.data_compra).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    {' · '}parcela {editingTransaction.recorrente_index}/{editingTransaction.recorrente_total}
                  </p>
                )}
              </div>

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
                {/* (Q) Calculadora — teclado */}
                {calcOpen && (
                  <div className="ntx-calc" ref={calcRef}>
                    <div className="ntx-calc__display" aria-live="polite">{calcExpr || '0'}</div>
                    <div className="ntx-calc__pad">
                      {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', ',', '⌫', '+'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          className={`ntx-calc__key${'÷×−+'.includes(k) ? ' ntx-calc__key--op' : ''}${k === '⌫' ? ' ntx-calc__key--del' : ''}`}
                          onClick={() => (k === '⌫' ? calcBackspace() : calcAppend(k))}
                          aria-label={k === '⌫' ? 'Apagar' : k}
                        >
                          {k}
                        </button>
                      ))}
                      <button type="button" className="ntx-calc__key ntx-calc__key--clear" onClick={calcClear}>C</button>
                      <button type="button" className="ntx-calc__key ntx-calc__key--eq" onClick={handleCalcSubmit} aria-label="Calcular e usar">=</button>
                    </div>
                  </div>
                )}
              </div>

              {formData.tipo === 'DESPESA' && cartoes.length > 0 && (
                <div className="form-group">
                  <label>
                    Cartão de crédito <span className="modal-label-optional">(opcional)</span>
                  </label>
                  <CategorySelector
                    name="cartao_id"
                    value={formData.cartao_id || ''}
                    onChange={handleChange}
                    options={[{ id: '', nome: 'À vista / sem cartão' }, ...cartoes]}
                    placeholder="À vista / sem cartão"
                    isOpen={activeSelect === 'cartao_id'}
                    onToggle={setActiveSelect}
                    required={false}
                    zIndex={6}
                    actionItem={{
                      label: 'Cadastrar cartão',
                      onClick: () => {
                        onClose?.()
                        navigate('/cartoes')
                      },
                    }}
                  />
                </div>
              )}
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

            {/* ── Seção: Parcelamento (só criação, e só despesa) ── */}
            {!isEditMode && formData.tipo === 'DESPESA' && (() => {
              const numParcelas = parseInt(formData.num_parcelas, 10)
              const parcelaInicial = Math.max(1, parseInt(formData.parcela_inicial, 10) || 1)
              const numParcelasRestantes = numParcelas - parcelaInicial + 1
              const valorNum = parseFloat(formData.valor)
              const valorParcela = formData.parcelado && numParcelas >= 2 && valorNum > 0
                ? formatCurrencyBRL(Math.floor((valorNum / numParcelas) * 100) / 100)
                : null
              const selectedCartao = cartoes.find((c) => String(c.id) === String(formData.cartao_id))
              const parcelaInfo = selectedCartao && Number.isFinite(numParcelas) && numParcelas >= 2
                ? calcularParcelaAtual(formData.data_transacao, selectedCartao.dia_vencimento, numParcelas)
                : null
              const parcelasJaPagas = parcelaInfo ? parcelaInfo.parcelaInicial - 1 : 0

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
                          {formatCurrencyBRL(valorNum)}
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
                            {parcelaInicial > 1 ? `Vencimento da ${parcelaInicial}ª parcela` : 'Data de vencimento'}
                          </label>
                          <input
                            id="tx-data-pagamento"
                            type="date"
                            value={formData.data_pagamento}
                            onChange={(e) => setFormData((prev) => ({ ...prev, data_pagamento: e.target.value }))}
                            className="input-premium rec-vezes-row__input rec-vezes-row__input--date"
                          />
                        </div>
                        {selectedCartao && (
                          <p className="parcelamento-preview parcelamento-preview--cartao">
                            {selectedCartao.nome} · vence todo dia {selectedCartao.dia_vencimento}
                          </p>
                        )}
                        <p className="parcelamento-preview parcelamento-preview--hint">
                          {formData.prazo_indeterminado
                            ? 'Assinatura/stream sem fim: desconta esse valor todo mês até cancelar.'
                            : parcelaInicial > 1
                              ? `As parcelas 1 a ${parcelaInicial - 1} não serão lançadas (começa na ${parcelaInicial}ª).`
                              : parcelasJaPagas > 0
                                ? `${parcelasJaPagas} parcela(s) já vencida(s) entram como pagas; a próxima pendente é a ${parcelaInfo.parcelaInicial}ª.`
                                : 'Vencimento da 1ª parcela. Se vazio, usa a data da transação.'}
                        </p>
                        {formData.prazo_indeterminado && valorNum > 0 && (
                          <p className="parcelamento-preview">
                            Mensal · {formatCurrencyBRL(valorNum)} · sem prazo
                          </p>
                        )}
                        {!formData.prazo_indeterminado && valorParcela && (
                          <p className="parcelamento-preview">
                            {parcelaInicial > 1
                              ? `${numParcelasRestantes} parcelas (${parcelaInicial}/${numParcelas} a ${numParcelas}/${numParcelas}) · ${valorParcela} cada`
                              : `${numParcelas}x de ${valorParcela} · total ${formatCurrencyBRL(valorNum)}`}
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

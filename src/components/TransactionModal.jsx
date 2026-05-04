import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { apiUrl } from '../lib/apiUrl'
import { showToast } from '../lib/toastStore'
import CategorySelector from './transaction/CategorySelector'
import RecurrenceOptions from './transaction/RecurrenceOptions'
import { useTransactionForm } from '../hooks/useTransactionForm'

function tipoCategoriaIgual(tipoCampo, tipoAlvo) {
  return String(tipoCampo ?? '').trim().toUpperCase() === String(tipoAlvo ?? '').trim().toUpperCase()
}

export default function TransactionModal({ isOpen, onClose, onSave, usuarioId, editingTransaction = null }) {
  const [categorias, setCategorias] = useState([])
  const [loadingCats, setLoadingCats] = useState(false)
  const [activeSelect, setActiveSelect] = useState(null)
  const [aiTexto, setAiTexto] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const valorInputRef = useRef(null)
  const modalSheetRef = useRef(null)

  const scrollValorIntoView = useCallback(() => {
    const el = valorInputRef.current
    if (!el) return
    requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
    window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320)
  }, [])

  const fetchCategorias = useCallback(async () => {
    setLoadingCats(true)
    try {
      const res = await fetch(apiUrl('/api/categorias'), {
        headers: { 'x-user-id': usuarioId },
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
  }, [usuarioId])

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
    applyAiParsed,
  } = useTransactionForm({ usuarioId, editingTransaction, isOpen, categorias, onSave, onClose })

  const preencherComIA = useCallback(async () => {
    const t = aiTexto.trim()
    if (!t || !usuarioId) return
    setAiBusy(true)
    try {
      const res = await fetch(apiUrl('/api/ai/transacao-parse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': usuarioId },
        body: JSON.stringify({ texto: t }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.message || 'Não foi possível interpretar.', 'error')
        return
      }
      const r = data.resultado
      if (r?.tipo === 'CHAT') {
        showToast(r.resposta || 'Não identifiquei um lançamento nesse texto.', 'info')
        return
      }
      if (applyAiParsed(r)) {
        showToast('Campos preenchidos — confira categoria e salve.', 'success')
        setAiTexto('')
      } else {
        showToast('Inclua valor e tipo (ex.: "gastei 45,90 no mercado ontem").', 'error')
      }
    } catch {
      showToast('Sem conexão. Tente de novo.', 'error')
    } finally {
      setAiBusy(false)
    }
  }, [aiTexto, usuarioId, applyAiParsed])

  // Inicializa o formulário e busca categorias ao abrir
  useEffect(() => {
    if (!isOpen || !usuarioId) return
    fetchCategorias()
    initForm()
    setTimeout(() => {
      const el = valorInputRef.current
      if (!el) return
      el.focus()
      scrollValorIntoView()
    }, 120)
  }, [isOpen, usuarioId, editingTransaction?.id, fetchCategorias, initForm, scrollValorIntoView])

  useEffect(() => {
    if (!isOpen) setAiTexto('')
  }, [isOpen])

  // Trava scroll do body enquanto modal está aberto
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
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
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      sheet?.style.removeProperty('--keyboard-overlap')
    }
  }, [isOpen])

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
    <div className="modal-backdrop">
      <div className="modal-content modal-content--nova-tx" ref={modalSheetRef}>
        <div className="modal-header">
          <h3>{isEditMode ? 'Editar Transação' : 'Nova Transação'}</h3>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Fechar">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form modal-form--sheet">
          <div className="modal-body modal-body--nova-tx">

            {!isEditMode && (
              <section className="nova-tx-section" aria-labelledby="nova-tx-h-ia">
                <h4 id="nova-tx-h-ia" className="nova-tx-section__title">
                  Escreva como no WhatsApp (IA)
                </h4>
                <p className="nova-tx-section__hint" style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Ex.: &quot;gastei 89,90 no mercado ontem&quot;, &quot;recebi 3500 de salário hoje&quot;
                </p>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text"
                    value={aiTexto}
                    onChange={(e) => setAiTexto(e.target.value)}
                    placeholder="Descreva o lançamento em uma frase…"
                    className="input-premium"
                    disabled={aiBusy || loadingCats}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ alignSelf: 'flex-start' }}
                    disabled={aiBusy || loadingCats || !aiTexto.trim()}
                    onClick={() => void preencherComIA()}
                  >
                    {aiBusy ? 'Interpretando…' : 'Preencher com IA'}
                  </button>
                </div>
              </section>
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
                    onClick={() => handleTypeChange('DESPESA')}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    className={`type-btn receita ${formData.tipo === 'RECEITA' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('RECEITA')}
                  >
                    Receita
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ opacity: loadingCats ? 0.5 : 1 }}>
                <label>Categoria</label>
                <CategorySelector
                  name="categoria_id"
                  value={formData.categoria_id}
                  onChange={handleChange}
                  options={categoriasFiltradas}
                  placeholder="Escolha uma categoria…"
                  isOpen={activeSelect === 'categoria_id'}
                  onToggle={setActiveSelect}
                  zIndex={10}
                />
              </div>

              {subcategorias.length > 0 && (
                <div className="form-group slide-down">
                  <label>Subcategoria</label>
                  <CategorySelector
                    name="subcategoria_id"
                    value={formData.subcategoria_id}
                    onChange={handleChange}
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
                  className="input-premium"
                />
              </div>
            </section>

            {/* ── Seção: Valor e Data ── */}
            <section className="nova-tx-section">
              <div className="form-group">
                <label htmlFor="tx-valor">Valor (R$)</label>
                <input
                  id="tx-valor"
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

            {/* ── Seção: Recorrência (só criação) ── */}
            {!isEditMode && (
              <RecurrenceOptions
                checked={formData.recorrencia_dia_1}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, recorrencia_dia_1: e.target.checked }))
                }
              />
            )}

          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
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

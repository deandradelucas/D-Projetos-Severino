import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { maskCurrencyBRLInput, parseCurrencyBRLMasked, valorToMaskedBRL } from '../../lib/currencyMaskBr'
import { parsePercentualCdiInput } from '../../lib/percentualCdiInput'
import { INVESTIMENTOS_PRESETS_LIST } from '../../lib/investimentosPresets'
import { filtrarInstituicoesFinanceiras, labelTipoInstituicao } from '../../lib/instituicoesFinanceiras'

function percentualGravadoParaInput(raw) {
  if (raw == null || raw === '') return ''
  const n = Number(raw)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: false })
}

function localDateInputToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function minDataVencimento(dataAquisicaoYmd) {
  if (!dataAquisicaoYmd) return ''
  const d = new Date(`${dataAquisicaoYmd}T12:00:00`)
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dataVencimentoInicialParaInput(edit) {
  const raw = edit?.data_vencimento
  if (raw == null || String(raw).trim() === '') return ''
  const s = String(raw).trim()
  const head = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (head) return head[1]
  return ''
}

function dataAquisicaoInicialParaInput(edit) {
  const raw = edit?.data_aquisicao
  if (raw != null && String(raw).trim() !== '') {
    const s = String(raw).trim()
    const head = s.match(/^(\d{4}-\d{2}-\d{2})/)
    if (head) return head[1]
    const t = Date.parse(s)
    if (!Number.isNaN(t)) {
      const d = new Date(t)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }
  return localDateInputToday()
}

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   onSubmit: (payload: { instituicao_nome: string, preset?: string, nome_custom?: string, valor_investido: number, percentual_cdi: number, data_aquisicao: string, data_vencimento: string | null }) => Promise<void>
 *   submitting?: boolean
 *   initialEdit?: { id: string, instituicao_nome?: string | null, tipo_preset?: string | null, nome?: string | null, valor_investido?: number | null, percentual_cdi?: number | null, data_aquisicao?: string | null, data_vencimento?: string | null } | null
 * }} props
 */
export default function InvestimentoNovoModal({ open, onClose, onSubmit, submitting = false, initialEdit = null }) {
  const titleId = useId()
  const stepInstTitleId = useId()
  const stepTipoTitleId = useId()
  const stepOutroTitleId = useId()
  const stepDataTitleId = useId()
  const stepValorTitleId = useId()
  const stepPercTitleId = useId()
  const instListId = useId()
  const instInputId = useId()
  const tipoSelectId = useId()
  const dataInputId = useId()
  const dataVencimentoInputId = useId()
  const valorInputId = useId()
  const percInputId = useId()
  const blurTimerRef = useRef(null)
  const comboboxWrapRef = useRef(null)
  const listRef = useRef(null)

  const [instQuery, setInstQuery] = useState(() => String(initialEdit?.instituicao_nome ?? '').trim())
  const [instChosen, setInstChosen] = useState(() => {
    const n = String(initialEdit?.instituicao_nome ?? '').trim()
    return n.length >= 2 ? n : null
  })
  const [instListOpen, setInstListOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(null)

  const [preset, setPreset] = useState(() => {
    if (!initialEdit?.id) return 'LCA'
    const tp = initialEdit.tipo_preset
    if (tp != null && String(tp).trim() !== '') return String(tp).trim().toUpperCase()
    return null
  })
  const [customNome, setCustomNome] = useState(() => {
    if (!initialEdit?.id) return ''
    const tp = initialEdit.tipo_preset
    if (tp != null && String(tp).trim() !== '') return ''
    return String(initialEdit.nome ?? '').trim()
  })
  const [valorInput, setValorInput] = useState(() =>
    initialEdit?.valor_investido != null && Number.isFinite(Number(initialEdit.valor_investido))
      ? valorToMaskedBRL(Number(initialEdit.valor_investido))
      : '',
  )
  const [percInput, setPercInput] = useState(() => percentualGravadoParaInput(initialEdit?.percentual_cdi))
  const [dataAquisicaoInput, setDataAquisicaoInput] = useState(() => dataAquisicaoInicialParaInput(initialEdit))
  const [dataVencimentoInput, setDataVencimentoInput] = useState(() => dataVencimentoInicialParaInput(initialEdit))
  const [formError, setFormError] = useState('')
  const [tipoIndexador, setTipoIndexador] = useState(() => {
    if (!initialEdit?.id) return 'CDI'
    return initialEdit.tipo_indexador === 'PREFIXADO' ? 'PREFIXADO' : 'CDI'
  })
  const [nomePersonalizadoExpandido, setNomePersonalizadoExpandido] = useState(() =>
    Boolean(initialEdit?.id) && !initialEdit?.tipo_preset && String(initialEdit?.nome ?? '').trim().length > 0,
  )

  const instituicoesFiltradas = useMemo(() => filtrarInstituicoesFinanceiras(instQuery), [instQuery])

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (activeIndex === null || !listRef.current) return
    const item = listRef.current.querySelector(`#${CSS.escape(`${instListId}-opt-${activeIndex}`)}`)
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, instListId])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('horizon-modal-open')
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.body.classList.remove('horizon-modal-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, submitting])

  useEffect(() => {
    if (!open) return
    const inst = String(initialEdit?.instituicao_nome ?? '').trim()
    setInstQuery(inst)
    setInstChosen(inst.length >= 2 ? inst : null)
    setInstListOpen(false)
    setActiveIndex(null)
    if (!initialEdit?.id) {
      setPreset('LCA')
      setCustomNome('')
    } else {
      const tp = initialEdit.tipo_preset
      if (tp != null && String(tp).trim() !== '') {
        setPreset(String(tp).trim().toUpperCase())
        setCustomNome('')
      } else {
        setPreset(null)
        setCustomNome(String(initialEdit.nome ?? '').trim())
      }
    }
    setValorInput(
      initialEdit?.valor_investido != null && Number.isFinite(Number(initialEdit.valor_investido))
        ? valorToMaskedBRL(Number(initialEdit.valor_investido))
        : '',
    )
    setPercInput(percentualGravadoParaInput(initialEdit?.percentual_cdi))
    setDataAquisicaoInput(dataAquisicaoInicialParaInput(initialEdit))
    setDataVencimentoInput(dataVencimentoInicialParaInput(initialEdit))
    setTipoIndexador(initialEdit?.tipo_indexador === 'PREFIXADO' ? 'PREFIXADO' : 'CDI')
    setNomePersonalizadoExpandido(
      Boolean(initialEdit?.id) && !initialEdit?.tipo_preset && String(initialEdit?.nome ?? '').trim().length > 0,
    )
    setFormError('')
  }, [
    open,
    initialEdit?.id,
    initialEdit?.instituicao_nome,
    initialEdit?.tipo_preset,
    initialEdit?.nome,
    initialEdit?.valor_investido,
    initialEdit?.percentual_cdi,
    initialEdit?.data_aquisicao,
    initialEdit?.data_vencimento,
    initialEdit?.tipo_indexador,
  ])

  if (!open) return null

  const editando = Boolean(initialEdit?.id)
  const tituloModal = editando ? 'Editar investimento' : 'Novo investimento'

  const scheduleCloseList = () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current)
    blurTimerRef.current = window.setTimeout(() => {
      setInstListOpen(false)
      setActiveIndex(null)
    }, 160)
  }

  const handleBackdropDown = (e) => {
    if (e.target === e.currentTarget && !submitting) onClose()
  }

  const resolveInstituicao = () => {
    const raw = (instChosen ?? instQuery).trim()
    return raw
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setFormError('')
    const instFinal = resolveInstituicao()
    if (instFinal.length < 2) {
      setFormError('Informe o banco ou corretora — pesquise na lista ou digite o nome completo.')
      return
    }

    const valorRounded = parseCurrencyBRLMasked(valorInput)
    if (!Number.isFinite(valorRounded) || valorRounded < 0.01) {
      setFormError('Informe o valor investido (mínimo R$ 0,01). Digite só números — os dois últimos são centavos.')
      return
    }
    if (valorRounded > 999_999_999_999.99) {
      setFormError('Valor acima do limite permitido.')
      return
    }

    let percRounded
    try {
      percRounded = parsePercentualCdiInput(percInput)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Percentual do CDI inválido.')
      return
    }

    const dataStr = String(dataAquisicaoInput ?? '').trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      setFormError('Informe a data de aquisição.')
      return
    }

    const vencimentoStr = dataVencimentoInput.trim() || null
    const trimmed = customNome.trim()
    if (trimmed.length >= 2) {
      await onSubmit({
        instituicao_nome: instFinal,
        nome_custom: trimmed,
        valor_investido: valorRounded,
        percentual_cdi: percRounded,
        data_aquisicao: dataStr,
        tipo_indexador: tipoIndexador,
        data_vencimento: vencimentoStr,
      })
      return
    }
    if (preset) {
      await onSubmit({
        instituicao_nome: instFinal,
        preset,
        valor_investido: valorRounded,
        percentual_cdi: percRounded,
        data_aquisicao: dataStr,
        tipo_indexador: tipoIndexador,
        data_vencimento: vencimentoStr,
      })
      return
    }
    if (trimmed.length === 1) {
      setFormError('Nome do investimento muito curto (mínimo 2 caracteres).')
      return
    }
    setFormError('Escolha um tipo na lista ou informe outro investimento.')
  }

  const selecionarInstituicao = (nome) => {
    setInstChosen(nome)
    setInstQuery(nome)
    setInstListOpen(false)
  }

  return (
    <div className="modal-backdrop page-investimentos-modal-backdrop" role="presentation" onMouseDown={handleBackdropDown}>
      <div
        className="modal-content page-investimentos-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id={titleId}>{tituloModal}</h3>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Fechar" disabled={submitting}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body page-investimentos-modal__body">

            {/* Banco ou corretora */}
            <div className="page-investimentos-modal__section">
              <div ref={comboboxWrapRef} className="page-investimentos-inst-combobox">
                <label htmlFor={instInputId} className="page-investimentos-modal__section-label">
                  Banco ou corretora
                </label>
                <input
                  id={instInputId}
                  type="text"
                  className="page-investimentos-modal__input"
                  placeholder="Sicredi, Nubank, XP, Itaú…"
                  maxLength={120}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={instListOpen}
                  aria-controls={instListId}
                  aria-activedescendant={activeIndex !== null && instListOpen ? `${instListId}-opt-${activeIndex}` : undefined}
                  disabled={submitting}
                  value={instQuery}
                  onChange={(e) => {
                    const v = e.target.value
                    setInstQuery(v)
                    setActiveIndex(null)
                    if (instChosen != null && v !== instChosen) setInstChosen(null)
                    setInstListOpen(String(v).trim().length > 0)
                  }}
                  onKeyDown={(e) => {
                    if (!instListOpen || instituicoesFiltradas.length === 0) {
                      if (e.key === 'Escape') { setInstListOpen(false); setActiveIndex(null) }
                      return
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setActiveIndex((prev) => (prev === null ? 0 : Math.min(prev + 1, instituicoesFiltradas.length - 1)))
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setActiveIndex((prev) => (prev === null ? instituicoesFiltradas.length - 1 : Math.max(prev - 1, 0)))
                    } else if (e.key === 'Enter') {
                      if (activeIndex !== null && instituicoesFiltradas[activeIndex]) {
                        e.preventDefault()
                        selecionarInstituicao(instituicoesFiltradas[activeIndex].nome)
                        setActiveIndex(null)
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setInstListOpen(false)
                      setActiveIndex(null)
                    }
                  }}
                  onBlur={(e) => {
                    const next = e.relatedTarget
                    if (next instanceof Node && comboboxWrapRef.current?.contains(next)) return
                    scheduleCloseList()
                  }}
                  onFocus={() => {
                    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current)
                  }}
                />
                {instListOpen ? (
                  <ul id={instListId} ref={listRef} className="page-investimentos-inst-dropdown" role="listbox">
                    {instituicoesFiltradas.length === 0 ? (
                      <li className="page-investimentos-inst-dropdown__empty" role="presentation">
                        Não encontrado na lista — o texto digitado será usado.
                      </li>
                    ) : (
                      instituicoesFiltradas.map((row, i) => (
                        <li
                          key={row.nome}
                          id={`${instListId}-opt-${i}`}
                          role="option"
                          aria-selected={activeIndex === i}
                          className="page-investimentos-inst-dropdown__item-wrap"
                        >
                          <button
                            type="button"
                            className={`page-investimentos-inst-option${activeIndex === i ? ' page-investimentos-inst-option--active' : ''}`}
                            tabIndex={-1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { selecionarInstituicao(row.nome); setActiveIndex(null) }}
                          >
                            <span className="page-investimentos-inst-option__nome">{row.nome}</span>
                            <span className="page-investimentos-inst-option__tipo">{labelTipoInstituicao(row.tipo)}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
            </div>

            {/* Tipo de aplicação */}
            <div className="page-investimentos-modal__section">
              <label htmlFor={tipoSelectId} className="page-investimentos-modal__section-label">
                Tipo de aplicação
              </label>
              <select
                id={tipoSelectId}
                className="page-investimentos-modal__input page-investimentos-modal__input--select"
                value={preset ?? '__custom__'}
                disabled={submitting}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__custom__') {
                    setPreset(null)
                    setNomePersonalizadoExpandido(true)
                  } else {
                    setPreset(v)
                    setCustomNome('')
                    setNomePersonalizadoExpandido(false)
                    if (String(percInput).trim() === '') {
                      if (v === 'POUPANCA') setPercInput('70')
                      else if (v === 'TESOURO_SELIC') setPercInput('100')
                    }
                  }
                }}
              >
                {INVESTIMENTOS_PRESETS_LIST.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
                <option value="__custom__">Outro (personalizado)</option>
              </select>
              {preset === 'POUPANCA' && (
                <p className="page-investimentos-modal__hint page-investimentos-modal__hint--preset">
                  Poupança ≈ 70% CDI · isenta IR (PF) · use <strong>70</strong> no campo % CDI
                </p>
              )}
              {preset === 'TESOURO_SELIC' && (
                <p className="page-investimentos-modal__hint page-investimentos-modal__hint--preset">
                  Tesouro Selic ≈ 100% CDI · use <strong>100</strong> no campo % CDI
                </p>
              )}
              {(preset === 'CRI' || preset === 'CRA' || preset === 'DEBENTURE') && (
                <p className="page-investimentos-modal__hint page-investimentos-modal__hint--preset">
                  Isento de IR para pessoa física
                </p>
              )}
            </div>

            {/* Data de aquisição + Valor investido */}
            <div className="page-investimentos-modal__section page-investimentos-modal__section--row">
              <div>
                <label htmlFor={dataInputId} className="page-investimentos-modal__section-label">
                  Data de aquisição
                </label>
                <input
                  id={dataInputId}
                  type="date"
                  className="page-investimentos-modal__input page-investimentos-modal__input--date"
                  required
                  max={localDateInputToday()}
                  disabled={submitting}
                  value={dataAquisicaoInput}
                  onChange={(e) => setDataAquisicaoInput(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor={valorInputId} className="page-investimentos-modal__section-label">
                  Valor investido
                </label>
                <div className="page-investimentos-modal__valor-input-wrap">
                  <span className="page-investimentos-modal__valor-prefix" aria-hidden>
                    R$
                  </span>
                  <input
                    id={valorInputId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="page-investimentos-modal__input page-investimentos-modal__input--valor"
                    placeholder="0,00"
                    disabled={submitting}
                    value={valorInput}
                    onChange={(e) => setValorInput(maskCurrencyBRLInput(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Data de vencimento (opcional) */}
            <div className="page-investimentos-modal__section">
              <label htmlFor={dataVencimentoInputId} className="page-investimentos-modal__section-label">
                Data de vencimento{' '}
                <span className="page-investimentos-modal__label-optional">(opcional)</span>
              </label>
              <input
                id={dataVencimentoInputId}
                type="date"
                className="page-investimentos-modal__input page-investimentos-modal__input--date"
                min={minDataVencimento(dataAquisicaoInput)}
                disabled={submitting}
                value={dataVencimentoInput}
                onChange={(e) => setDataVencimentoInput(e.target.value)}
              />
              <p className="page-investimentos-modal__hint">
                Preencha se souber quando vence — o app mostrará o prazo restante e usará esta data no simulador.
              </p>
            </div>

            {/* Taxa */}
            <div className="page-investimentos-modal__section">
              <span className="page-investimentos-modal__section-label">
                {tipoIndexador === 'PREFIXADO' ? 'Taxa pré-fixada a.a.' : '% do CDI contratada'}
              </span>
              <div className="page-investimentos-modal__indexador-toggle" role="group" aria-label="Tipo de taxa">
                <button
                  type="button"
                  className={`page-investimentos-modal__indexador-btn${tipoIndexador === 'CDI' ? ' page-investimentos-modal__indexador-btn--active' : ''}`}
                  aria-pressed={tipoIndexador === 'CDI'}
                  disabled={submitting}
                  onClick={() => { setTipoIndexador('CDI'); setPercInput('') }}
                >
                  % do CDI
                </button>
                <button
                  type="button"
                  className={`page-investimentos-modal__indexador-btn${tipoIndexador === 'PREFIXADO' ? ' page-investimentos-modal__indexador-btn--active' : ''}`}
                  aria-pressed={tipoIndexador === 'PREFIXADO'}
                  disabled={submitting}
                  onClick={() => { setTipoIndexador('PREFIXADO'); setPercInput('') }}
                >
                  Pré-fixado
                </button>
              </div>
              <label htmlFor={percInputId} className="sr-only">
                {tipoIndexador === 'PREFIXADO' ? 'Taxa pré-fixada em % a.a.' : '% do CDI contratada'}
              </label>
              <div className="page-investimentos-modal__perc-input-wrap">
                <input
                  id={percInputId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="page-investimentos-modal__input page-investimentos-modal__input--perc"
                  placeholder={tipoIndexador === 'PREFIXADO' ? '12,5' : '100'}
                  disabled={submitting}
                  value={percInput}
                  onChange={(e) => setPercInput(e.target.value)}
                />
                <span className="page-investimentos-modal__perc-suffix" aria-hidden>
                  {tipoIndexador === 'PREFIXADO' ? '% a.a.' : '% do CDI'}
                </span>
              </div>
            </div>

            {/* Nome personalizado (colapsável) */}
            <div className="page-investimentos-modal__section page-investimentos-modal__section--custom">
              <button
                type="button"
                className="page-investimentos-modal__toggle-link"
                aria-expanded={nomePersonalizadoExpandido}
                onClick={() => setNomePersonalizadoExpandido((v) => !v)}
              >
                {nomePersonalizadoExpandido ? '− Nome personalizado' : '+ Nome personalizado'}
              </button>
              {nomePersonalizadoExpandido ? (
                <div style={{ marginTop: '0.5rem' }}>
                  <label htmlFor="investimento-outro-nome" className="sr-only">Nome personalizado</label>
                  <input
                    id="investimento-outro-nome"
                    type="text"
                    className="page-investimentos-modal__input"
                    placeholder="Ex.: Tesouro Selic 2027, fundo multimercado…"
                    maxLength={120}
                    value={customNome}
                    disabled={submitting}
                    onChange={(e) => {
                      setCustomNome(e.target.value)
                      setPreset(null)
                    }}
                  />
                </div>
              ) : null}
            </div>

            {formError ? (
              <p className="page-investimentos-modal__error" role="alert">
                {formError}
              </p>
            ) : null}
          </div>
          <div className="page-investimentos-modal__footer">
            <p className="page-investimentos-modal__footer-hint">Os dados ficam só na sua conta.</p>
            <div className="page-investimentos-modal__footer-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'A guardar…' : editando ? 'Guardar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

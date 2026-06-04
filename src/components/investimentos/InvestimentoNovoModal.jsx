import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useSheetDragClose } from '../../hooks/useSheetDragClose'
import { maskCurrencyBRLInput, parseCurrencyBRLMasked, valorToMaskedBRL } from '../../lib/currencyMaskBr'
import DatePickerBrPopover from './DatePickerBrPopover'
import { maskDateBrInput, parseDdMmYyyyStrict, ymdToDdMmYyyy } from '../../lib/dateInputBr'
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

function brAquisicaoInicial(edit) {
  return ymdToDdMmYyyy(dataAquisicaoInicialParaInput(edit))
}

function brVencimentoInicial(edit) {
  const ymd = dataVencimentoInicialParaInput(edit)
  return ymd ? ymdToDdMmYyyy(ymd) : ''
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
  const btnCalAquisicaoRef = useRef(null)
  const btnCalVencimentoRef = useRef(null)
  const sheetRef = useRef(null)
  useSheetDragClose(sheetRef, { open, onClose })

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
  const [dataAquisicaoBr, setDataAquisicaoBr] = useState(() => brAquisicaoInicial(initialEdit))
  const [dataVencimentoBr, setDataVencimentoBr] = useState(() => brVencimentoInicial(initialEdit))
  const [formError, setFormError] = useState('')
  const [tipoIndexador, setTipoIndexador] = useState(() => {
    if (!initialEdit?.id) return 'CDI'
    return initialEdit.tipo_indexador === 'PREFIXADO' ? 'PREFIXADO' : 'CDI'
  })
  const [nomePersonalizadoExpandido, setNomePersonalizadoExpandido] = useState(() =>
    Boolean(initialEdit?.id) && !initialEdit?.tipo_preset && String(initialEdit?.nome ?? '').trim().length > 0,
  )
  const [pickerAquisicaoOpen, setPickerAquisicaoOpen] = useState(false)
  const [pickerVencimentoOpen, setPickerVencimentoOpen] = useState(false)
  const [notas, setNotas] = useState(() => String(initialEdit?.notas ?? '').trim())
  const [metaInput, setMetaInput] = useState(() =>
    initialEdit?.meta_carteira_valor != null && Number.isFinite(Number(initialEdit.meta_carteira_valor))
      ? valorToMaskedBRL(Number(initialEdit.meta_carteira_valor))
      : '',
  )

  const instituicoesFiltradas = useMemo(() => filtrarInstituicoesFinanceiras(instQuery), [instQuery])

  const dataAquisicaoYmd = useMemo(() => parseDdMmYyyyStrict(dataAquisicaoBr), [dataAquisicaoBr])
  const dataVencimentoYmd = useMemo(() => parseDdMmYyyyStrict(dataVencimentoBr), [dataVencimentoBr])

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
    if (!open) return undefined
    const id = window.requestAnimationFrame(() => {
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
      setDataAquisicaoBr(brAquisicaoInicial(initialEdit))
      setDataVencimentoBr(brVencimentoInicial(initialEdit))
      setTipoIndexador(initialEdit?.tipo_indexador === 'PREFIXADO' ? 'PREFIXADO' : 'CDI')
      setNomePersonalizadoExpandido(
        Boolean(initialEdit?.id) && !initialEdit?.tipo_preset && String(initialEdit?.nome ?? '').trim().length > 0,
      )
      setNotas(String(initialEdit?.notas ?? '').trim())
      setMetaInput(
        initialEdit?.meta_carteira_valor != null && Number.isFinite(Number(initialEdit.meta_carteira_valor))
          ? valorToMaskedBRL(Number(initialEdit.meta_carteira_valor))
          : '',
      )
      setFormError('')
    })
    return () => window.cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- campos primitivos de initialEdit; evita loop quando o pai passa objeto novo a cada render
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

    const dataStr = parseDdMmYyyyStrict(dataAquisicaoBr)
    if (!dataStr) {
      setFormError('Informe a data de aquisição no formato dd/mm/aaaa.')
      return
    }
    const hoje = localDateInputToday()
    if (dataStr > hoje) {
      setFormError('A data de aquisição não pode ser futura.')
      return
    }

    let vencimentoStr = null
    const vTrim = String(dataVencimentoBr ?? '').trim()
    if (vTrim) {
      const vy = parseDdMmYyyyStrict(dataVencimentoBr)
      if (!vy) {
        setFormError('Data de vencimento inválida — use dd/mm/aaaa.')
        return
      }
      const minV = minDataVencimento(dataStr)
      if (minV && vy < minV) {
        setFormError('A data de vencimento deve ser pelo menos um dia após a aquisição.')
        return
      }
      vencimentoStr = vy
    }
    const metaVal = metaInput.trim() ? parseCurrencyBRLMasked(metaInput) : null
    const notasVal = notas.trim() || null

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
        notas: notasVal,
        meta_carteira_valor: metaVal,
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
        notas: notasVal,
        meta_carteira_valor: metaVal,
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
    <>
    <div className="modal-backdrop page-investimentos-modal-backdrop" role="presentation" onMouseDown={handleBackdropDown}>
      <div
        className="modal-content page-investimentos-modal"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id={titleId}>{tituloModal}</h3>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Fechar" disabled={submitting}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body page-investimentos-modal__body">
            <div className="page-investimentos-modal__surface">

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
                    if (String(instQuery).trim().length > 0) setInstListOpen(true)
                  }}
                />
                {instListOpen ? (
                  <ul id={instListId} ref={listRef} className="page-investimentos-inst-dropdown" role="listbox">
                    {instituicoesFiltradas.length === 0 ? (
                      <li className="page-investimentos-inst-dropdown__empty" role="presentation">
                        Nenhuma instituição na lista começa assim — o texto digitado será usado.
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
                <div className="page-investimentos-modal__date-field-wrap">
                  <input
                    id={dataInputId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="dd/mm/aaaa"
                    lang="pt-BR"
                    required
                    className="page-investimentos-modal__input page-investimentos-modal__input--date-br"
                    disabled={submitting}
                    value={dataAquisicaoBr}
                    onChange={(e) => setDataAquisicaoBr(maskDateBrInput(e.target.value))}
                  />
                  <button
                    ref={btnCalAquisicaoRef}
                    type="button"
                    className="page-investimentos-modal__date-cal-btn"
                    disabled={submitting}
                    aria-label="Abrir calendário — data de aquisição"
                    aria-expanded={pickerAquisicaoOpen}
                    onClick={() => {
                      setPickerVencimentoOpen(false)
                      setPickerAquisicaoOpen((v) => !v)
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </button>
                </div>
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
              <div className="page-investimentos-modal__date-field-wrap">
                <input
                  id={dataVencimentoInputId}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="dd/mm/aaaa"
                  lang="pt-BR"
                  className="page-investimentos-modal__input page-investimentos-modal__input--date-br"
                  disabled={submitting}
                  value={dataVencimentoBr}
                  onChange={(e) => setDataVencimentoBr(maskDateBrInput(e.target.value))}
                />
                <button
                  ref={btnCalVencimentoRef}
                  type="button"
                  className="page-investimentos-modal__date-cal-btn"
                  disabled={submitting}
                  aria-label="Abrir calendário — data de vencimento"
                  aria-expanded={pickerVencimentoOpen}
                  onClick={() => {
                    setPickerAquisicaoOpen(false)
                    setPickerVencimentoOpen((v) => !v)
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              </div>
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
                <div className="page-investimentos-modal__custom-field">
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

            {/* Notas e meta — seção extra */}
            <div className="page-investimentos-modal__section page-investimentos-modal__section--extras">
              <p className="page-investimentos-modal__section-label">Notas (opcional)</p>
              <textarea
                className="page-investimentos-modal__input page-investimentos-modal__input--textarea"
                placeholder="Ex.: renovar quando vencer, fundos de emergência…"
                maxLength={500}
                rows={3}
                disabled={submitting}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
              <p className="page-investimentos-modal__char-count">{notas.length}/500</p>
            </div>

            <div className="page-investimentos-modal__section">
              <label className="page-investimentos-modal__section-label">Meta da carteira (opcional)</label>
              <div className="page-investimentos-modal__perc-input-wrap">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="page-investimentos-modal__input"
                  placeholder="R$ 0,00"
                  disabled={submitting}
                  value={metaInput}
                  onChange={(e) => setMetaInput(maskCurrencyBRLInput(e.target.value))}
                />
              </div>
              <p className="page-investimentos-modal__hint">Valor total que deseja atingir na carteira.</p>
            </div>

            </div>{/* /surface */}

            {formError ? (
              <p className="page-investimentos-modal__error" role="alert">
                {formError}
              </p>
            ) : null}
          </div>{/* /modal-body */}
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

    <DatePickerBrPopover
      open={pickerAquisicaoOpen}
      onClose={() => setPickerAquisicaoOpen(false)}
      anchorRef={btnCalAquisicaoRef}
      valueYmd={dataAquisicaoYmd}
      onSelectYmd={(ymd) => setDataAquisicaoBr(ymdToDdMmYyyy(ymd))}
      maxYmd={localDateInputToday()}
    />
    <DatePickerBrPopover
      open={pickerVencimentoOpen}
      onClose={() => setPickerVencimentoOpen(false)}
      anchorRef={btnCalVencimentoRef}
      valueYmd={dataVencimentoYmd}
      onSelectYmd={(ymd) => setDataVencimentoBr(ymdToDdMmYyyy(ymd))}
      minYmd={dataAquisicaoYmd ? minDataVencimento(dataAquisicaoYmd) : undefined}
      showClear
      onClear={() => setDataVencimentoBr('')}
    />
    </>
  )
}

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
 *   onSubmit: (payload: { instituicao_nome: string, preset?: string, nome_custom?: string, valor_investido: number, percentual_cdi: number, data_aquisicao: string }) => Promise<void>
 *   submitting?: boolean
 *   initialEdit?: { id: string, instituicao_nome?: string | null, tipo_preset?: string | null, nome?: string | null, valor_investido?: number | null, percentual_cdi?: number | null, data_aquisicao?: string | null } | null
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
  const dataInputId = useId()
  const valorInputId = useId()
  const percInputId = useId()
  const blurTimerRef = useRef(null)
  const comboboxWrapRef = useRef(null)

  const [instQuery, setInstQuery] = useState(() => String(initialEdit?.instituicao_nome ?? '').trim())
  const [instChosen, setInstChosen] = useState(() => {
    const n = String(initialEdit?.instituicao_nome ?? '').trim()
    return n.length >= 2 ? n : null
  })
  const [instListOpen, setInstListOpen] = useState(false)

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
  const [formError, setFormError] = useState('')

  const instituicoesFiltradas = useMemo(() => filtrarInstituicoesFinanceiras(instQuery), [instQuery])

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current)
    }
  }, [])

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
  ])

  if (!open) return null

  const editando = Boolean(initialEdit?.id)
  const tituloModal = editando ? 'Editar investimento' : 'Novo investimento'

  const scheduleCloseList = () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current)
    blurTimerRef.current = window.setTimeout(() => setInstListOpen(false), 160)
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

    const trimmed = customNome.trim()
    if (trimmed.length >= 2) {
      await onSubmit({
        instituicao_nome: instFinal,
        nome_custom: trimmed,
        valor_investido: valorRounded,
        percentual_cdi: percRounded,
        data_aquisicao: dataStr,
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
            <p className="page-investimentos-modal__lead">
              Instituição, tipo ou nome livre, data de aquisição, valor aplicado e % do CDI contratada.
            </p>

            <section className="page-investimentos-modal__card" aria-labelledby={stepInstTitleId}>
              <div className="page-investimentos-modal__card-head">
                <span className="page-investimentos-modal__step-num" aria-hidden>
                  1
                </span>
                <div className="page-investimentos-modal__card-head-text">
                  <h4 id={stepInstTitleId} className="page-investimentos-modal__card-title">
                    Banco ou corretora
                  </h4>
                  <p className="page-investimentos-modal__card-desc">Custódia do investimento</p>
                </div>
              </div>
              <fieldset className="page-investimentos-modal__fieldset" aria-labelledby={stepInstTitleId}>
                <legend className="sr-only">Banco ou corretora</legend>
                <div ref={comboboxWrapRef} className="page-investimentos-inst-combobox">
                  <label htmlFor={instInputId} className="page-investimentos-modal__label page-investimentos-modal__label--inline">
                    Pesquisar instituição
                  </label>
                  <input
                    id={instInputId}
                    type="text"
                    className="page-investimentos-modal__input"
                    placeholder="Ex.: Sicredi, Nubank, XP, Banco do Brasil…"
                    maxLength={120}
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={instListOpen}
                    aria-controls={instListId}
                    disabled={submitting}
                    value={instQuery}
                    onChange={(e) => {
                      const v = e.target.value
                      setInstQuery(v)
                      if (instChosen != null && v !== instChosen) setInstChosen(null)
                      const temBusca = String(v).trim().length > 0
                      setInstListOpen(temBusca)
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
                    <ul id={instListId} className="page-investimentos-inst-dropdown" role="listbox">
                      {instituicoesFiltradas.length === 0 ? (
                        <li className="page-investimentos-inst-dropdown__empty" role="presentation">
                          Nenhum resultado na lista. Você pode usar o texto digitado acima como instituição ao adicionar.
                        </li>
                      ) : (
                        instituicoesFiltradas.map((row) => (
                          <li key={row.nome} role="option" className="page-investimentos-inst-dropdown__item-wrap">
                            <button
                              type="button"
                              className="page-investimentos-inst-option"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selecionarInstituicao(row.nome)}
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
                <p className="page-investimentos-modal__hint">
                  Digite para ver sugestões; escolha uma opção ou use o nome completo se não aparecer na lista.
                </p>
              </fieldset>
            </section>

            <section className="page-investimentos-modal__card" aria-labelledby={stepTipoTitleId}>
              <div className="page-investimentos-modal__card-head">
                <span className="page-investimentos-modal__step-num" aria-hidden>
                  2
                </span>
                <div className="page-investimentos-modal__card-head-text">
                  <h4 id={stepTipoTitleId} className="page-investimentos-modal__card-title">
                    Tipo de aplicação
                  </h4>
                  <p className="page-investimentos-modal__card-desc">Atalhos para os produtos mais comuns</p>
                </div>
              </div>
              <fieldset className="page-investimentos-modal__fieldset" aria-labelledby={stepTipoTitleId}>
                <legend className="sr-only">Tipo de investimento</legend>
                <div className="page-investimentos-preset-grid" role="group" aria-label="Tipo de investimento">
                  {INVESTIMENTOS_PRESETS_LIST.map((p) => {
                    const active = preset === p.key
                    return (
                      <button
                        key={p.key}
                        type="button"
                        className={`page-investimentos-preset-chip${active ? ' page-investimentos-preset-chip--active' : ''}`}
                        aria-pressed={active}
                        disabled={submitting}
                        onClick={() => {
                          setPreset(p.key)
                          setCustomNome('')
                        }}
                      >
                        <span className="page-investimentos-preset-chip__label">{p.label}</span>
                        {p.hint ? <span className="page-investimentos-preset-chip__hint">{p.hint}</span> : null}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </section>

            <section
              className="page-investimentos-modal__card page-investimentos-modal__card--soft"
              aria-labelledby={stepOutroTitleId}
            >
              <div className="page-investimentos-modal__card-head">
                <span className="page-investimentos-modal__step-num page-investimentos-modal__step-num--optional" aria-hidden>
                  3
                </span>
                <div className="page-investimentos-modal__card-head-text">
                  <h4 id={stepOutroTitleId} className="page-investimentos-modal__card-title">
                    Outro nome <span className="page-investimentos-modal__optional-tag">opcional</span>
                  </h4>
                  <p className="page-investimentos-modal__card-desc">Substitui o tipo escolhido em cima quando preenchido</p>
                </div>
              </div>
              <div className="page-investimentos-modal__custom">
                <label htmlFor="investimento-outro-nome" className="page-investimentos-modal__label">
                  Nome livre
                </label>
                <input
                  id="investimento-outro-nome"
                  type="text"
                  className="page-investimentos-modal__input"
                  placeholder="Ex.: Tesouro Selic, debêntures, fundo multimercado…"
                  maxLength={120}
                  value={customNome}
                  disabled={submitting}
                  onChange={(e) => {
                    setCustomNome(e.target.value)
                    setPreset(null)
                  }}
                />
                <p className="page-investimentos-modal__hint">
                  Útil quando o produto não está na grelha ou quer um rótulo próprio na carteira.
                </p>
              </div>
            </section>

            <section className="page-investimentos-modal__card" aria-labelledby={stepDataTitleId}>
              <div className="page-investimentos-modal__card-head">
                <span className="page-investimentos-modal__step-num" aria-hidden>
                  4
                </span>
                <div className="page-investimentos-modal__card-head-text">
                  <h4 id={stepDataTitleId} className="page-investimentos-modal__card-title">
                    Data de aquisição
                  </h4>
                  <p className="page-investimentos-modal__card-desc">Quando passou a deter esta posição</p>
                </div>
              </div>
              <div className="page-investimentos-modal__data-field">
                <label htmlFor={dataInputId} className="page-investimentos-modal__label">
                  Data
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
                <p className="page-investimentos-modal__hint">
                  Usada para estimar o IR regressivo sobre o rendimento (prazo desde a aquisição).
                </p>
              </div>
            </section>

            <section className="page-investimentos-modal__card" aria-labelledby={stepValorTitleId}>
              <div className="page-investimentos-modal__card-head">
                <span className="page-investimentos-modal__step-num" aria-hidden>
                  5
                </span>
                <div className="page-investimentos-modal__card-head-text">
                  <h4 id={stepValorTitleId} className="page-investimentos-modal__card-title">
                    Valor investido
                  </h4>
                  <p className="page-investimentos-modal__card-desc">Quanto você aplicou nesta posição (referência em reais)</p>
                </div>
              </div>
              <div className="page-investimentos-modal__valor-field">
                <label htmlFor={valorInputId} className="page-investimentos-modal__label">
                  Valor (R$)
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
                <p className="page-investimentos-modal__hint">
                  Igual à transação: só números — formata em real (ex.: digitar 150050 vira 1.500,50). Referência só para o seu acompanhamento.
                </p>
              </div>
            </section>

            <section className="page-investimentos-modal__card" aria-labelledby={stepPercTitleId}>
              <div className="page-investimentos-modal__card-head">
                <span className="page-investimentos-modal__step-num" aria-hidden>
                  6
                </span>
                <div className="page-investimentos-modal__card-head-text">
                  <h4 id={stepPercTitleId} className="page-investimentos-modal__card-title">
                    % do CDI contratada
                  </h4>
                  <p className="page-investimentos-modal__card-desc">
                    Taxa pactuada em relação ao CDI (ex.: 100% do CDI ou 110%)
                  </p>
                </div>
              </div>
              <div className="page-investimentos-modal__perc-field">
                <label htmlFor={percInputId} className="page-investimentos-modal__label">
                  Percentual
                </label>
                <div className="page-investimentos-modal__perc-input-wrap">
                  <input
                    id={percInputId}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="page-investimentos-modal__input page-investimentos-modal__input--perc"
                    placeholder="100"
                    disabled={submitting}
                    value={percInput}
                    onChange={(e) => setPercInput(e.target.value)}
                  />
                  <span className="page-investimentos-modal__perc-suffix" aria-hidden>
                    % do CDI
                  </span>
                </div>
                <p className="page-investimentos-modal__hint">
                  Use vírgula para decimais (ex.: 105,5). Pode incluir ou não o símbolo %.
                </p>
              </div>
            </section>

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

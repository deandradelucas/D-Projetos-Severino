import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useModalA11y } from '../../hooks/useModalA11y'
import { maskCurrencyBRLInput, parseCurrencyBRLMasked } from '../../lib/currencyMaskBr'
import { useSheetDragClose } from '../../hooks/useSheetDragClose'
import DatePickerBrPopover from './DatePickerBrPopover'
import { maskDateBrInput, parseDdMmYyyyStrict, ymdToDdMmYyyy } from '../../lib/dateInputBr'

function localDateToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function InvestimentoAporteModal({ open, onClose, onSubmit, submitting = false, investimentoNome = '' }) {
  const titleId = useId()
  const valorInputId = useId()
  const dataInputId = useId()
  const valorInputRef = useRef(null)
  const sheetRef = useRef(null)
  const btnCalRef = useRef(null)
  useSheetDragClose(sheetRef, { open, onClose })
  useModalA11y({ open, onClose, containerRef: sheetRef, autoFocus: false })

  const [valorInput, setValorInput] = useState('')
  const [dataBr, setDataBr] = useState(() => ymdToDdMmYyyy(localDateToday()))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [errors, setErrors] = useState({})

  const dataYmd = useMemo(() => parseDdMmYyyyStrict(dataBr), [dataBr])

  useEffect(() => {
    if (!open) return
    setValorInput('') // eslint-disable-line react-hooks/set-state-in-effect
    setDataBr(ymdToDdMmYyyy(localDateToday()))
    setPickerOpen(false)
    setErrors({})
    const focusTimer = window.setTimeout(() => valorInputRef.current?.focus(), 60)
    return () => window.clearTimeout(focusTimer)
  }, [open])

  if (!open) return null

  const handleValorInput = (e) => {
    setValorInput(maskCurrencyBRLInput(e.target.value))
  }

  const validate = () => {
    const errs = {}
    const v = parseCurrencyBRLMasked(valorInput)
    if (!valorInput.trim()) errs.valor = 'Informe o valor do aporte.'
    else if (!Number.isFinite(v) || v < 0.01) errs.valor = 'Valor inválido (mínimo R$ 0,01).'
    if (!dataYmd) errs.data = 'Informe a data do aporte (dd/mm/aaaa).'
    else if (dataYmd > localDateToday()) errs.data = 'A data do aporte não pode ser no futuro.'
    return errs
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    onSubmit({ valor: parseCurrencyBRLMasked(valorInput), data_aquisicao: dataYmd })
  }

  return (
    <>
    <div
      className="modal-backdrop page-investimentos-modal-backdrop"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-content page-investimentos-modal page-investimentos-aporte-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={sheetRef}>
        <div className="modal-header">
          <h3 id={titleId} className="modal-title">
            Novo aporte{investimentoNome ? ` — ${investimentoNome}` : ''}
          </h3>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Fechar"
            disabled={submitting}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="page-investimentos-modal__body modal-body">
            <p className="page-investimentos-modal__lead">
              Este aporte terá seu próprio prazo de IR regressivo a partir da data informada — independente do aporte original.
            </p>

            <div className="page-investimentos-modal__card">
              <div className="page-investimentos-modal__fieldset">
                <div className="page-investimentos-modal__valor-field">
                  <label className="page-investimentos-modal__label" htmlFor={valorInputId}>
                    Valor do aporte
                  </label>
                  <div className="page-investimentos-modal__valor-input-wrap">
                    <span className="page-investimentos-modal__valor-prefix" aria-hidden>R$</span>
                    <input
                      ref={valorInputRef}
                      id={valorInputId}
                      type="text"
                      inputMode="decimal"
                      className="page-investimentos-modal__input page-investimentos-modal__input--valor"
                      placeholder="0,00"
                      value={valorInput}
                      onChange={handleValorInput}
                      autoComplete="off"
                      disabled={submitting}
                      aria-describedby={errors.valor ? `${valorInputId}-err` : undefined}
                    />
                  </div>
                  {errors.valor && (
                    <p id={`${valorInputId}-err`} className="page-investimentos-modal__error" role="alert">
                      {errors.valor}
                    </p>
                  )}
                </div>

                <div className="page-investimentos-modal__data-field">
                  <label className="page-investimentos-modal__label" htmlFor={dataInputId}>
                    Data do aporte
                  </label>
                  <div className="page-investimentos-modal__date-field-wrap">
                    <input
                      id={dataInputId}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="dd/mm/aaaa"
                      lang="pt-BR"
                      className="page-investimentos-modal__input page-investimentos-modal__input--date-br"
                      value={dataBr}
                      onChange={(e) => setDataBr(maskDateBrInput(e.target.value))}
                      disabled={submitting}
                      aria-describedby={errors.data ? `${dataInputId}-err` : undefined}
                    />
                    <button
                      ref={btnCalRef}
                      type="button"
                      className="page-investimentos-modal__date-cal-btn"
                      disabled={submitting}
                      aria-label="Abrir calendário — data do aporte"
                      aria-expanded={pickerOpen}
                      onClick={() => setPickerOpen((v) => !v)}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </button>
                  </div>
                  {errors.data && (
                    <p id={`${dataInputId}-err`} className="page-investimentos-modal__error" role="alert">
                      {errors.data}
                    </p>
                  )}
                  <p className="page-investimentos-modal__hint">A data não pode ser no futuro.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="page-investimentos-modal__footer modal-footer">
            <div className="page-investimentos-modal__footer-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Salvando…' : 'Confirmar aporte'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <DatePickerBrPopover
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      anchorRef={btnCalRef}
      valueYmd={dataYmd}
      onSelectYmd={(ymd) => setDataBr(ymdToDdMmYyyy(ymd))}
      maxYmd={localDateToday()}
    />
    </>
  )
}

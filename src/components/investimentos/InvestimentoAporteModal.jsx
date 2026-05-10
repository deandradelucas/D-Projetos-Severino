import React, { useEffect, useId, useRef, useState } from 'react'
import { maskCurrencyBRLInput, parseCurrencyBRLMasked } from '../../lib/currencyMaskBr'

function localDateToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function InvestimentoAporteModal({ open, onClose, onSubmit, submitting = false, investimentoNome = '' }) {
  const titleId = useId()
  const valorInputId = useId()
  const dataInputId = useId()
  const valorInputRef = useRef(null)

  const [valorInput, setValorInput] = useState('')
  const [dataInput, setDataInput] = useState(localDateToday())
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!open) return
    setValorInput('') // eslint-disable-line react-hooks/set-state-in-effect
    setDataInput(localDateToday())
    setErrors({})
    setTimeout(() => valorInputRef.current?.focus(), 60)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const handleValorInput = (e) => {
    setValorInput(maskCurrencyBRLInput(e.target.value))
  }

  const validate = () => {
    const errs = {}
    const v = parseCurrencyBRLMasked(valorInput)
    if (!valorInput.trim()) errs.valor = 'Informe o valor do aporte.'
    else if (!Number.isFinite(v) || v < 0.01) errs.valor = 'Valor inválido (mínimo R$ 0,01).'
    if (!dataInput) errs.data = 'Informe a data do aporte.'
    else if (dataInput > localDateToday()) errs.data = 'A data do aporte não pode ser no futuro.'
    return errs
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    onSubmit({ valor: parseCurrencyBRLMasked(valorInput), data_aquisicao: dataInput })
  }

  return (
    <div
      className="modal-backdrop page-investimentos-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-content page-investimentos-modal page-investimentos-aporte-modal">
        <div className="modal-header">
          <h3 id={titleId} className="modal-title">
            Novo aporte{investimentoNome ? ` — ${investimentoNome}` : ''}
          </h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar"
            disabled={submitting}
          >
            ×
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
                  <input
                    id={dataInputId}
                    type="date"
                    className="page-investimentos-modal__input page-investimentos-modal__input--date"
                    max={localDateToday()}
                    value={dataInput}
                    onChange={(e) => setDataInput(e.target.value)}
                    disabled={submitting}
                    aria-describedby={errors.data ? `${dataInputId}-err` : undefined}
                  />
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
  )
}

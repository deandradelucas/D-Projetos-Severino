import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { INVESTIMENTOS_PRESETS_LIST } from '../../lib/investimentosPresets'
import { filtrarInstituicoesFinanceiras, labelTipoInstituicao } from '../../lib/instituicoesFinanceiras'

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   onSubmit: (payload: { instituicao_nome: string, preset?: string, nome_custom?: string }) => Promise<void>
 *   submitting?: boolean
 * }} props
 */
export default function InvestimentoNovoModal({ open, onClose, onSubmit, submitting = false }) {
  const titleId = useId()
  const instListId = useId()
  const instInputId = useId()
  const blurTimerRef = useRef(null)
  const comboboxWrapRef = useRef(null)

  const [instQuery, setInstQuery] = useState('')
  const [instChosen, setInstChosen] = useState(/** @type {string | null} */ (null))
  const [instListOpen, setInstListOpen] = useState(false)

  const [preset, setPreset] = useState(/** @type {string | null} */ ('LCA'))
  const [customNome, setCustomNome] = useState('')
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

  if (!open) return null

  const scheduleCloseList = () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current)
    blurTimerRef.current = window.setTimeout(() => setInstListOpen(false), 160)
  }

  const cancelCloseList = () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current)
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

    const trimmed = customNome.trim()
    if (trimmed.length >= 2) {
      await onSubmit({ instituicao_nome: instFinal, nome_custom: trimmed })
      return
    }
    if (preset) {
      await onSubmit({ instituicao_nome: instFinal, preset })
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
          <h3 id={titleId}>Novo investimento</h3>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Fechar" disabled={submitting}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body page-investimentos-modal__body">
            <p className="page-investimentos-modal__lead">
              Indique onde o investimento está custodiado; depois escolha o tipo ou informe outro nome.
            </p>

            <fieldset className="page-investimentos-modal__fieldset">
              <legend className="page-investimentos-modal__legend">Banco ou corretora</legend>
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
                  }}
                  onFocus={() => {
                    cancelCloseList()
                    setInstListOpen(true)
                  }}
                  onBlur={(e) => {
                    const next = e.relatedTarget
                    if (next instanceof Node && comboboxWrapRef.current?.contains(next)) return
                    scheduleCloseList()
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
                Toque num resultado para preencher ou digite o nome completo se não aparecer na lista.
              </p>
            </fieldset>

            <fieldset className="page-investimentos-modal__fieldset">
              <legend className="page-investimentos-modal__legend">Tipos principais</legend>
              <div className="page-investimentos-preset-grid" role="group" aria-label="Tipo de investimento">
                {INVESTIMENTOS_PRESETS_LIST.map((p) => {
                  const active = preset === p.key
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={`page-investimentos-preset-chip${active ? ' page-investimentos-preset-chip--active' : ''}`}
                      aria-pressed={active}
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

            <div className="page-investimentos-modal__custom">
              <label htmlFor="investimento-outro-nome" className="page-investimentos-modal__label">
                Outro investimento
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
              <p className="page-investimentos-modal__hint">Ao digitar aqui, usa-se este nome em vez do tipo selecionado acima.</p>
            </div>

            {formError ? (
              <p className="page-investimentos-modal__error" role="alert">
                {formError}
              </p>
            ) : null}
          </div>
          <div className="page-investimentos-modal__footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'A guardar…' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

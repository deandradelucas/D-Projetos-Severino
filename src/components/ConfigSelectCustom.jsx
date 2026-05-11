import React, { useEffect, useId, useRef, useState } from 'react'

/**
 * Select estilizado (lista custom) — evita popup nativo do sistema que ignora tema escuro no Windows.
 * @param {{ id: string, value: string, onChange: (v: string) => void, options: { value: string, label: string }[], disabled?: boolean }} props
 */
export default function ConfigSelectCustom({ id, value, onChange, options, disabled }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const listboxId = useId()
  const selected = options.find((o) => o.value === value) ?? options[0]

  const choose = (nextValue) => {
    setOpen(false)
    onChange(nextValue)
  }

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    /* fase bubble: corre depois do clique na opção; opção usa stopPropagation para não disparar isto */
    document.addEventListener('click', closeOnOutsideClick)
    return () => document.removeEventListener('click', closeOnOutsideClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div
      ref={rootRef}
      className={`config-select-custom${open ? ' config-select-custom--open' : ''}`}
    >
      <button
        type="button"
        id={id}
        className="config-select-custom__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) setOpen((v) => !v)
        }}
      >
        <span className="config-select-custom__value">{selected?.label}</span>
        <span className="config-select-custom__chevron" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open ? (
        <ul id={listboxId} className="config-select-custom__menu" role="listbox">
          {options.map((opt) => (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`config-select-custom__option${opt.value === value ? ' config-select-custom__option--selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  choose(opt.value)
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

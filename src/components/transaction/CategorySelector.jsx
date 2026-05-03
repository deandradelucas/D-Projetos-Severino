import React, { useState, useEffect, useRef } from 'react'

/**
 * CategorySelector — Dropdown com busca para escolha de categoria/subcategoria.
 * Extraído do TransactionModal para uso isolado e testável.
 */
const CategorySelector = ({ name, value, onChange, options, placeholder, isOpen, onToggle, zIndex = 1 }) => {
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        if (isOpen) {
          onToggle(null)
          setSearch('')
        }
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onToggle])

  useEffect(() => {
    if (!isOpen) return

    const shouldFocusSearch = typeof window === 'undefined' || !window.matchMedia('(max-width: 768px)').matches
    if (!shouldFocusSearch) return

    const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 50)

    return () => {
      clearTimeout(focusTimer)
    }
  }, [isOpen])

  const filteredOptions = options.filter((o) =>
    String(o?.nome ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && search && filteredOptions.length > 0) {
      e.preventDefault()
      onChange({ target: { name, value: filteredOptions[0].id } })
      onToggle(null)
      setSearch('')
    } else if (e.key === 'Escape') {
      onToggle(null)
      setSearch('')
    }
  }

  const selected = options.find((o) => String(o.id) === String(value))

  return (
    <div className={`custom-select ${isOpen ? 'open' : ''}`} ref={ref} style={{ zIndex }}>
      <input
        type="text"
        name={name}
        value={value}
        readOnly
        required
        className="sr-only"
        style={{ opacity: 0, position: 'absolute', zIndex: -1, width: '100%', height: '100%', bottom: 0, left: 0 }}
      />
      <div className="custom-select-trigger" onClick={() => onToggle(isOpen ? null : name)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {selected?.cor && <div className="category-dot" style={{ backgroundColor: selected.cor }} />}
          <span className={selected ? 'text-white' : 'text-placeholder'}>
            {selected ? selected.nome : placeholder}
          </span>
        </div>
        <svg
          className={`chevron ${isOpen ? 'rotate' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ width: '16px', height: '16px', transition: 'transform 0.2s' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <div className="custom-select-dropdown">
        <div className="custom-select-search">
          <input
            type="text"
            placeholder="Procurar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            ref={searchInputRef}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="custom-select-options">
          {filteredOptions.length === 0 && (
            <div className="custom-select-no-results">Nenhum resultado</div>
          )}
          {filteredOptions.map((opt) => (
            <div
              key={opt.id}
              className={`custom-select-option ${String(value) === String(opt.id) ? 'selected' : ''}`}
              onClick={() => {
                onChange({ target: { name, value: opt.id } })
                onToggle(null)
                setSearch('')
              }}
            >
              {opt.cor && <div className="category-dot" style={{ backgroundColor: opt.cor }} />}
              {opt.nome}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CategorySelector

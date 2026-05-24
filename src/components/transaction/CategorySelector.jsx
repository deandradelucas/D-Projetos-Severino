import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const CategorySelector = ({ name, value, onChange, options, placeholder, isOpen, onToggle, zIndex = 1 }) => {
  const [search, setSearch]     = useState('')
  const containerRef            = useRef(null)
  const triggerRef              = useRef(null)
  const searchInputRef          = useRef(null)
  const [dropPos, setDropPos]   = useState(null)

  // Calcula posição do dropdown com base no trigger
  useEffect(() => {
    if (!isOpen) { setDropPos(null); return }
    const update = () => {
      if (!triggerRef.current) return
      const r = triggerRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 2, left: r.left, width: r.width })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [isOpen])

  // Fecha ao clicar fora (container ou portal)
  useEffect(() => {
    const handleClick = (e) => {
      const portal = document.getElementById(`cs-portal-${name}`)
      const inContainer = containerRef.current?.contains(e.target)
      const inPortal    = portal?.contains(e.target)
      if (!inContainer && !inPortal && isOpen) {
        onToggle(null)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onToggle, name])

  // Foca busca ao abrir (desktop)
  useEffect(() => {
    if (!isOpen) return
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
    if (isMobile) return
    const t = setTimeout(() => searchInputRef.current?.focus(), 50)
    return () => clearTimeout(t)
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

  // Portal: renderiza dropdown no body, acima de qualquer overlay
  const portalDropdown = isOpen && dropPos ? createPortal(
    <div
      id={`cs-portal-${name}`}
      className="custom-select open"
      style={{
        position: 'fixed',
        top:      dropPos.top,
        left:     dropPos.left,
        width:    dropPos.width,
        zIndex:   10200,
        pointerEvents: 'all',
      }}
    >
      <div
        className="custom-select-dropdown"
        style={{ position: 'static', display: 'flex' }}
      >
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
    </div>,
    document.body
  ) : null

  return (
    <>
      <div className={`custom-select ${isOpen ? 'open' : ''}`} ref={containerRef} style={{ zIndex }}>
        <input
          type="text"
          name={name}
          value={value}
          readOnly
          required
          className="sr-only"
          style={{ opacity: 0, position: 'absolute', zIndex: -1, width: '100%', height: '100%', bottom: 0, left: 0 }}
        />
        <div className="custom-select-trigger" ref={triggerRef} onClick={() => onToggle(isOpen ? null : name)}>
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
        {/* dropdown não renderizado aqui — via portal abaixo */}
      </div>
      {portalDropdown}
    </>
  )
}

export default CategorySelector

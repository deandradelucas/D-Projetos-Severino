import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const CategorySelector = ({ name, value, onChange, options, placeholder, isOpen, onToggle, zIndex = 1, required = true, actionItem = null }) => {
  const [search, setSearch]     = useState('')
  const containerRef            = useRef(null)
  const triggerRef              = useRef(null)
  const searchInputRef          = useRef(null)
  const dropdownRef             = useRef(null)
  const [dropPos, setDropPos]   = useState(null)

  // Calcula posição do dropdown com base no trigger.
  // Quando isOpen=false o markup não renderiza o dropdown, então deixar
  // dropPos com valor antigo é benigno e evita setState dentro do effect.
  useEffect(() => {
    if (!isOpen) return
    const update = () => {
      if (!triggerRef.current) return
      const isMobile = window.matchMedia('(max-width: 768px)').matches
      if (isMobile) {
        // No mobile vira um BOTTOM SHEET: sobe de baixo e fica acima do teclado.
        // `bottom` = altura do teclado (0 sem teclado). Ao abrir o teclado, o
        // visualViewport encolhe e o sheet se reposiciona acima dele — a busca
        // (no topo do sheet) fica sempre visível.
        const vv = window.visualViewport
        const vH = vv?.height || window.innerHeight
        const kb = Math.max(0, window.innerHeight - ((vv?.offsetTop || 0) + vH))
        setDropPos({
          mobile: true,
          bottom: kb,
          maxHeight: Math.min(Math.round(vH * 0.72), vH - 12),
        })
      } else {
        const r = triggerRef.current.getBoundingClientRect()
        setDropPos({ top: r.bottom + 2, left: r.left, width: r.width, mobile: false })
      }
    }
    update()
    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('scroll', update, { capture: true, passive: true })
    const vv = window.visualViewport
    vv?.addEventListener('resize', update, { passive: true })
    vv?.addEventListener('scroll', update, { passive: true })
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
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

  // Mobile: arrastar o sheet pra baixo (pela barrinha/topo) fecha. Arrastar na
  // lista rola normalmente; só vira "fechar" se a lista estiver no topo.
  useEffect(() => {
    if (!isOpen || !dropPos?.mobile) return undefined
    const sheet = dropdownRef.current
    if (!sheet) return undefined
    let startY = 0, dy = 0, dragging = false, armed = false
    const optsEl = () => sheet.querySelector('.custom-select-options')
    const onStart = (e) => {
      if (e.touches.length !== 1) return
      startY = e.touches[0].clientY
      dy = 0
      dragging = false
      const opts = optsEl()
      const onList = opts && opts.contains(e.target)
      armed = !onList || opts.scrollTop <= 0
    }
    const onMove = (e) => {
      if (!armed) return
      dy = e.touches[0].clientY - startY
      if (dy <= 0) { if (dragging) { dragging = false; sheet.style.transform = '' } return }
      const opts = optsEl()
      if (opts && opts.contains(e.target) && opts.scrollTop > 0) { armed = false; return }
      if (!dragging && dy < 6) return
      dragging = true
      sheet.style.transition = 'none'
      if (e.cancelable) e.preventDefault()
      sheet.style.transform = `translateY(${dy}px)`
    }
    const onEnd = () => {
      if (!dragging) return
      dragging = false
      sheet.style.transition = 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)'
      if (dy > 90) {
        sheet.style.transform = 'translateY(100%)'
        window.setTimeout(() => { onToggle(null); setSearch('') }, 200)
      } else {
        sheet.style.transform = ''
      }
    }
    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd, { passive: true })
    sheet.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onEnd)
      sheet.style.transform = ''
      sheet.style.transition = ''
    }
  }, [isOpen, dropPos?.mobile, onToggle])

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
      className={`custom-select open${dropPos.mobile ? ' custom-select--cs-mobile' : ''}`}
      style={dropPos.mobile ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: dropPos.bottom,
        width: '100%',
        zIndex: 10200,
        pointerEvents: 'all',
      } : {
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
        ref={dropdownRef}
        style={{
          position: 'static',
          display: 'flex',
          maxHeight: dropPos.maxHeight ? `${dropPos.maxHeight}px` : undefined,
        }}
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
          {actionItem && (
            <div
              className="custom-select-option custom-select-option--action"
              onClick={() => {
                onToggle(null)
                setSearch('')
                actionItem.onClick()
              }}
              style={{
                color: 'var(--accent)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderTop: '1px solid rgba(0, 0, 0, 0.06)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              {actionItem.label}
            </div>
          )}
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
          required={required}
          className="sr-only"
          style={{ opacity: 0, position: 'absolute', zIndex: -1, width: '100%', height: '100%', bottom: 0, left: 0 }}
        />
        <div className="custom-select-trigger" ref={triggerRef} onClick={() => onToggle(isOpen ? null : name)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selected?.cor && <div className="category-dot" style={{ backgroundColor: selected.cor }} />}
            <span className={selected ? 'custom-select-value' : 'custom-select-placeholder'}>
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

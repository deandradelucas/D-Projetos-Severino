import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { compareYmd, todayYmdLocal, ymdFromCalendarParts } from '../../lib/dateInputBr'

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const POPOVER_W = 292
const POPOVER_H = 360

function buildMonthCells(viewYear, viewMonth) {
  const first = new Date(viewYear, viewMonth, 1)
  const padStart = first.getDay()
  const dim = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < padStart; i += 1) cells.push(null)
  for (let d = 1; d <= dim; d += 1) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  while (cells.length < 42) cells.push(null)
  return cells
}

function monthNamePt(viewMonth) {
  const d = new Date(2020, viewMonth, 1)
  const raw = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(d)
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function buildYearsRange(minYmd, maxYmd) {
  const cy = new Date().getFullYear()
  let lo =
    minYmd && /^\d{4}-\d{2}-\d{2}$/.test(minYmd) ? Number(minYmd.slice(0, 4)) : cy - 100
  let hi =
    maxYmd && /^\d{4}-\d{2}-\d{2}$/.test(maxYmd) ? Number(maxYmd.slice(0, 4)) : cy + 50
  if (!Number.isFinite(lo)) lo = cy - 100
  if (!Number.isFinite(hi)) hi = cy + 50
  if (lo > hi) [lo, hi] = [hi, lo]
  lo = Math.max(1900, lo)
  hi = Math.min(2100, hi)
  const arr = []
  for (let y = hi; y >= lo; y -= 1) arr.push(y)
  return arr
}

/**
 * Calendário pt-BR com visual alinhado ao modal de investimentos (portal → body).
 */
export default function DatePickerBrPopover({
  open,
  onClose,
  anchorRef,
  valueYmd,
  onSelectYmd,
  minYmd,
  maxYmd,
  showClear = false,
  onClear,
}) {
  const titleId = useId()
  const yearPickerId = useId()
  const popRef = useRef(null)
  const yearScrollRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const [view, setView] = useState(() => {
    const t = new Date()
    return { y: t.getFullYear(), m: t.getMonth() }
  })

  const yearsRange = useMemo(() => buildYearsRange(minYmd, maxYmd), [minYmd, maxYmd])

  useEffect(() => {
    if (!open) return undefined
    const id = requestAnimationFrame(() => {
      setYearPickerOpen(false)
      if (valueYmd && /^\d{4}-\d{2}-\d{2}$/.test(valueYmd)) {
        const [yy, mo] = valueYmd.split('-').map(Number)
        setView({ y: yy, m: mo - 1 })
      } else {
        const t = new Date()
        setView({ y: t.getFullYear(), m: t.getMonth() })
      }
    })
    return () => cancelAnimationFrame(id)
  }, [open, valueYmd])

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return undefined
    const r = anchorRef.current.getBoundingClientRect()
    const gap = 8
    let top = r.bottom + gap
    let left = r.right - POPOVER_W
    if (left < 8) left = 8
    if (left + POPOVER_W > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - POPOVER_W - 8)
    }
    if (top + POPOVER_H > window.innerHeight - 8) {
      top = Math.max(8, r.top - POPOVER_H - gap)
    }
    const id = requestAnimationFrame(() => setPos({ top, left }))
    return () => cancelAnimationFrame(id)
  }, [open, anchorRef, view.y, view.m])

  useLayoutEffect(() => {
    if (!open || !yearPickerOpen || !yearScrollRef.current) return undefined
    const id = requestAnimationFrame(() => {
      const el = yearScrollRef.current?.querySelector(`[data-year="${view.y}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [open, yearPickerOpen, view.y])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (yearPickerOpen) {
        e.preventDefault()
        setYearPickerOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, yearPickerOpen])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (popRef.current?.contains(t)) return
      if (anchorRef?.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [open, onClose, anchorRef])

  if (!open || typeof document === 'undefined') return null

  const cells = buildMonthCells(view.y, view.m)
  const today = todayYmdLocal()

  const dayDisabled = (dayNum) => {
    const ymd = ymdFromCalendarParts(view.y, view.m, dayNum)
    if (!ymd) return true
    if (minYmd && compareYmd(ymd, minYmd) < 0) return true
    if (maxYmd && compareYmd(ymd, maxYmd) > 0) return true
    return false
  }

  const pickDay = (dayNum) => {
    const ymd = ymdFromCalendarParts(view.y, view.m, dayNum)
    if (!ymd || dayDisabled(dayNum)) return
    onSelectYmd(ymd)
    onClose()
  }

  const goPrevMonth = () => {
    setYearPickerOpen(false)
    setView((v) => {
      let nm = v.m - 1
      let ny = v.y
      if (nm < 0) {
        nm = 11
        ny -= 1
      }
      return { y: ny, m: nm }
    })
  }

  const goNextMonth = () => {
    setYearPickerOpen(false)
    setView((v) => {
      let nm = v.m + 1
      let ny = v.y
      if (nm > 11) {
        nm = 0
        ny += 1
      }
      return { y: ny, m: nm }
    })
  }

  const pickYear = (yy) => {
    setView((v) => ({ ...v, y: yy }))
    setYearPickerOpen(false)
  }

  const pickToday = () => {
    const ymd = today
    if (minYmd && compareYmd(ymd, minYmd) < 0) return
    if (maxYmd && compareYmd(ymd, maxYmd) > 0) return
    onSelectYmd(ymd)
    onClose()
  }

  const clearAndClose = () => {
    onClear?.()
    onClose()
  }

  const todayDisabled =
    (minYmd && compareYmd(today, minYmd) < 0) || (maxYmd && compareYmd(today, maxYmd) > 0)

  const node = (
    <div
      ref={popRef}
      className="page-investimentos-date-popover"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: POPOVER_W,
        zIndex: 10060,
      }}
    >
      <div className="page-investimentos-date-popover__head">
        <button type="button" className="page-investimentos-date-popover__nav" aria-label="Mês anterior" onClick={goPrevMonth}>
          ‹
        </button>
        <div id={titleId} className="page-investimentos-date-popover__title">
          <span className="page-investimentos-date-popover__title-month">{monthNamePt(view.m)} de </span>
          <button
            type="button"
            id={yearPickerId}
            className="page-investimentos-date-popover__title-year-btn"
            aria-label="Escolher ano"
            aria-expanded={yearPickerOpen}
            aria-controls={`${yearPickerId}-panel`}
            onClick={() => setYearPickerOpen((v) => !v)}
          >
            {view.y}
          </button>
        </div>
        <button type="button" className="page-investimentos-date-popover__nav" aria-label="Próximo mês" onClick={goNextMonth}>
          ›
        </button>
      </div>

      {yearPickerOpen ? (
        <div
          ref={yearScrollRef}
          id={`${yearPickerId}-panel`}
          className="page-investimentos-date-popover__year-panel"
          role="listbox"
          aria-label="Ano"
          aria-activedescendant={yearPickerOpen ? `${yearPickerId}-y-${view.y}` : undefined}
        >
          {yearsRange.map((yy) => (
            <button
              key={yy}
              id={`${yearPickerId}-y-${yy}`}
              type="button"
              role="option"
              data-year={yy}
              aria-selected={yy === view.y}
              className={[
                'page-investimentos-date-popover__year-cell',
                yy === view.y ? 'page-investimentos-date-popover__year-cell--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => pickYear(yy)}
            >
              {yy}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="page-investimentos-date-popover__weekdays" aria-hidden>
            {WEEKDAYS_PT.map((w) => (
              <span key={w} className="page-investimentos-date-popover__weekday">
                {w}
              </span>
            ))}
          </div>

          <div className="page-investimentos-date-popover__grid">
            {cells.map((dayNum, i) => {
              if (dayNum == null) {
                return <span key={`e-${i}`} className="page-investimentos-date-popover__cell page-investimentos-date-popover__cell--empty" />
              }
              const ymd = ymdFromCalendarParts(view.y, view.m, dayNum)
              const dis = dayDisabled(dayNum)
              const selected = Boolean(valueYmd && ymd === valueYmd)
              const isToday = Boolean(ymd && ymd === today)
              return (
                <button
                  key={`${view.y}-${view.m}-${dayNum}`}
                  type="button"
                  disabled={dis}
                  onClick={() => pickDay(dayNum)}
                  className={[
                    'page-investimentos-date-popover__cell',
                    'page-investimentos-date-popover__cell--day',
                    selected ? 'page-investimentos-date-popover__cell--selected' : '',
                    isToday && !selected ? 'page-investimentos-date-popover__cell--today' : '',
                    dis ? 'page-investimentos-date-popover__cell--disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {dayNum}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="page-investimentos-date-popover__footer">
        {showClear ? (
          <button type="button" className="page-investimentos-date-popover__footer-btn" onClick={clearAndClose}>
            Limpar
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="page-investimentos-date-popover__footer-btn page-investimentos-date-popover__footer-btn--primary" disabled={todayDisabled} onClick={pickToday}>
          Hoje
        </button>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}

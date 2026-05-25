import React, { useMemo, useState, useId } from 'react'

const VIEWBOX = 200
const CENTER = VIEWBOX / 2
const OUTER_R = 70
const INNER_R = 48

function polar(angle, radius) {
  const rad = (angle - 90) * (Math.PI / 180)
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) }
}

function arcPath(startAngle, endAngle, padDeg) {
  const a0 = startAngle + padDeg
  const a1 = endAngle - padDeg
  if (a1 <= a0) return null
  const o0 = polar(a0, OUTER_R)
  const o1 = polar(a1, OUTER_R)
  const i0 = polar(a0, INNER_R)
  const i1 = polar(a1, INNER_R)
  const largeArc = a1 - a0 > 180 ? 1 : 0
  return [
    `M ${o0.x.toFixed(3)} ${o0.y.toFixed(3)}`,
    `A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 1 ${o1.x.toFixed(3)} ${o1.y.toFixed(3)}`,
    `L ${i1.x.toFixed(3)} ${i1.y.toFixed(3)}`,
    `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${i0.x.toFixed(3)} ${i0.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}

/**
 * Donut chart leve (SVG inline) — substitui o PieChart do recharts em
 * `InvestimentosResumo`. Decorativo (`aria-hidden`); a leitura para
 * acessibilidade é feita pela legenda textual logo abaixo.
 *
 * @param {{ data: { name: string, value: number }[], colors: string[],
 *           formatValue: (v: number) => string,
 *           legendStyle?: React.CSSProperties }} props
 */
export default function DonutChart({ data, colors, formatValue, legendStyle }) {
  const titleId = useId()
  const [hoverIdx, setHoverIdx] = useState(-1)

  const slices = useMemo(() => {
    const total = data.reduce((s, d) => s + (d.value > 0 ? d.value : 0), 0)
    if (total <= 0) return { items: [], total: 0 }
    const items = []
    let cursor = 0
    const padDeg = data.length > 1 ? 1 : 0
    for (const [i, d] of data.entries()) {
      const v = d.value > 0 ? d.value : 0
      const sweep = (v / total) * 360
      const pct = (v / total) * 100
      items.push({
        name: d.name,
        value: v,
        pct,
        color: colors[i % colors.length],
        path: arcPath(cursor, cursor + sweep, padDeg),
      })
      cursor += sweep
    }
    return { items, total }
  }, [data, colors])

  if (slices.total <= 0) return null

  const hovered = hoverIdx >= 0 ? slices.items[hoverIdx] : null
  const onlyOneSlice = slices.items.length === 1

  return (
    <div className="page-investimentos-resumo__donut">
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="page-investimentos-resumo__donut-svg"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>Alocação da carteira por tipo de investimento</title>
        {onlyOneSlice ? (
          <g>
            <circle cx={CENTER} cy={CENTER} r={OUTER_R} fill={slices.items[0].color} />
            <circle cx={CENTER} cy={CENTER} r={INNER_R} fill="var(--bg-card, #ffffff)" />
          </g>
        ) : (
          slices.items.map((s, i) => (
            <path
              key={s.name + i}
              d={s.path}
              fill={s.color}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(-1)}
              onFocus={() => setHoverIdx(i)}
              onBlur={() => setHoverIdx(-1)}
              tabIndex={0}
              style={{ cursor: 'default', transition: 'opacity 120ms ease' }}
              opacity={hoverIdx === -1 || hoverIdx === i ? 1 : 0.55}
            />
          ))
        )}
      </svg>

      {hovered ? (
        <div className="page-investimentos-resumo__tooltip" role="status" aria-live="polite">
          <p className="page-investimentos-resumo__tooltip-name">{hovered.name}</p>
          <p className="page-investimentos-resumo__tooltip-value">{formatValue(hovered.value)}</p>
        </div>
      ) : null}

      <ul className="page-investimentos-resumo__donut-legend" style={legendStyle}>
        {slices.items.map((s, i) => (
          <li key={s.name + i} className="page-investimentos-resumo__donut-legend-item">
            <span
              className="page-investimentos-resumo__donut-legend-dot"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="page-investimentos-resumo__donut-legend-text">
              {s.name} · {s.pct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

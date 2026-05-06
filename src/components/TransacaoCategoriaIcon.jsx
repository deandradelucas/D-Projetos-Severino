import React from 'react'
import {
  getTransacaoCategoriaIconKey,
  LINE_AWESOME_CLASS_BY_ICON_ID,
  RASTER_CATEGORIA_ICON_SRC_BY_KEY,
} from '../lib/transacaoCategoriaIconResolve.js'

/**
 * Ícone da transação — [Line Awesome](https://icons8.com/line-awesome) (Icons8, fonte MIT) ou PNG por categoria.
 */
export function TransacaoCategoriaIcon({ categoriaNome, subcategoriaNome, isReceita, size = 16, className }) {
  const resolved = getTransacaoCategoriaIconKey(categoriaNome, subcategoriaNome)
  const mapKey = resolved ?? (isReceita ? 'arrowUp' : 'arrowDown')

  const rasterSrc = RASTER_CATEGORIA_ICON_SRC_BY_KEY[mapKey]
  if (rasterSrc) {
    const icon = (
      <img
        src={rasterSrc}
        alt=""
        width={size}
        height={size}
        draggable={false}
        loading="lazy"
        decoding="async"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
        }}
        aria-hidden
      />
    )
    return className ? <span className={className}>{icon}</span> : icon
  }

  const laClass = LINE_AWESOME_CLASS_BY_ICON_ID[mapKey] || LINE_AWESOME_CLASS_BY_ICON_ID[isReceita ? 'arrowUp' : 'arrowDown']

  const icon = (
    <i
      className={`las ${laClass}`}
      style={{ fontSize: `${size}px`, lineHeight: 1, width: '1em', textAlign: 'center' }}
      aria-hidden
    />
  )

  return className ? <span className={className}>{icon}</span> : icon
}

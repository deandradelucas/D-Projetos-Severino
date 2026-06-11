import { getTransacaoCategoriaIconKey } from '../lib/transacaoCategoriaIconResolve.js'
import { CATEGORIA_ICON_ALIAS } from '../lib/categoriaIconStyle.js'

/**
 * Ícone da transação — PNGs 3D premium (Icons8 3D Fluency, 128px retina) em
 * /icons/categorias-3d, um por chave de categoria. Pix segue como SVG oficial
 * da marca (não existe 3D licenciado) e as setas receita/despesa continuam
 * SVG line-icon (fallback quando a transação não tem categoria reconhecida).
 */

/* Chaves com PNG 3D em public/icons/categorias-3d/{key}.png */
const ICON_3D = new Set([
  'utensils', 'fuel', 'car', 'home', 'health', 'education', 'leisure',
  'shopping', 'tech', 'subscription', 'fitness', 'receipt', 'pet', 'plane',
  'gift', 'wallet', 'work', 'investment', 'child', 'bank', 'sparkles',
  'percent', 'coins', 'handCoins', 'dollarCircle', 'building', 'scale',
])

/* Paths SVG remanescentes — viewBox 24. */
const PATHS = {
  // Pix — símbolo oficial da marca (Simple Icons, CC0). Path sólido (fill).
  pix: <path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156" />,
  arrowUp: <><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>,
  arrowDown: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
}

export function TransacaoCategoriaIcon({ categoriaNome, subcategoriaNome, isReceita, size = 18, className }) {
  const resolved = getTransacaoCategoriaIconKey(categoriaNome, subcategoriaNome)
  const mapKey = resolved ?? (isReceita ? 'arrowUp' : 'arrowDown')
  const iconName = CATEGORIA_ICON_ALIAS[mapKey] || mapKey

  let icon
  if (ICON_3D.has(iconName)) {
    icon = (
      <img
        src={`/icons/categorias-3d/${iconName}.png`}
        width={size}
        height={size}
        alt=""
        loading="lazy"
        draggable={false}
        style={{ display: 'block', objectFit: 'contain' }}
        aria-hidden="true"
      />
    )
  } else if (iconName === 'pix') {
    icon = (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {PATHS.pix}
      </svg>
    )
  } else {
    icon = (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {PATHS[iconName] || PATHS[isReceita ? 'arrowUp' : 'arrowDown']}
      </svg>
    )
  }

  return className ? <span className={className}>{icon}</span> : icon
}

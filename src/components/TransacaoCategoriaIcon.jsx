import { getTransacaoCategoriaIconKey } from '../lib/transacaoCategoriaIconResolve.js'
import { CATEGORIA_ICON_ALIAS } from '../lib/categoriaIconStyle.js'

/**
 * Ícone da transação — PNGs Icons8 estilo Pulsar Color (traço + preenchimento
 * colorido, 128px retina) em /icons/categorias, um por chave de categoria.
 * pix.png é gerado localmente (path oficial Simple Icons renderizado na paleta
 * Pulsar: traço #18193F + teal pastel #80CBC4) — não existe no catálogo Icons8.
 * As setas receita/despesa continuam SVG line-icon (fallback sem categoria).
 */

/* Chaves com PNG em public/icons/categorias/{key}.png */
const ICON_PNG = new Set([
  'utensils', 'fuel', 'car', 'home', 'health', 'education', 'leisure',
  'shopping', 'tech', 'subscription', 'fitness', 'receipt', 'pet', 'plane',
  'gift', 'wallet', 'work', 'investment', 'child', 'bank', 'sparkles',
  'percent', 'coins', 'handCoins', 'dollarCircle', 'building', 'scale', 'pix',
])

/* Paths SVG remanescentes — viewBox 24. */
const PATHS = {
  arrowUp: <><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>,
  arrowDown: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
}

export function TransacaoCategoriaIcon({ categoriaNome, subcategoriaNome, isReceita, size = 18, className }) {
  const resolved = getTransacaoCategoriaIconKey(categoriaNome, subcategoriaNome)
  const mapKey = resolved ?? (isReceita ? 'arrowUp' : 'arrowDown')
  const iconName = CATEGORIA_ICON_ALIAS[mapKey] || mapKey

  let icon
  if (ICON_PNG.has(iconName)) {
    icon = (
      <img
        src={`/icons/categorias/${iconName}.png`}
        width={size}
        height={size}
        alt=""
        loading="lazy"
        draggable={false}
        style={{ display: 'block', objectFit: 'contain' }}
        aria-hidden="true"
      />
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

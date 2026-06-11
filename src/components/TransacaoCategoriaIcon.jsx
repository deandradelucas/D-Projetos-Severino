import { getTransacaoCategoriaIconKey } from '../lib/transacaoCategoriaIconResolve.js'
import { CATEGORIA_ICON_ALIAS } from '../lib/categoriaIconStyle.js'

/**
 * Ícone da transação — PNGs Icons8 estilo Pulsar Color (traço + preenchimento
 * colorido, 128px retina) em /icons/categorias, um por chave de categoria.
 * pix.png é gerado localmente (path oficial Simple Icons renderizado na paleta
 * Pulsar: traço #18193F + teal pastel #80CBC4) — não existe no catálogo Icons8.
 * As setas receita/despesa continuam SVG line-icon (fallback sem categoria).
 */

/* Chaves com PNG em public/icons/categorias/{key}.png (Icons8 Pulsar Color, 128px) */
const ICON_PNG = new Set([
  // finanças
  'wallet', 'coins', 'handCoins', 'dollarCircle', 'dollar', 'moneybag', 'salary', 'piggy',
  'bank', 'creditcard', 'investment', 'chart', 'bitcoin', 'crypto', 'percent', 'scale', 'receipt', 'tax', 'idcard',
  // alimentação
  'utensils', 'restaurant', 'coffee', 'pizza', 'beer', 'wine', 'cake', 'groceries',
  // transporte
  'car', 'fuel', 'gas', 'bus', 'train', 'taxi', 'motorcycle', 'bicycle', 'parking', 'plane', 'luggage',
  // casa
  'home', 'building', 'hotel', 'plant', 'flower', 'tools', 'paint', 'bolt', 'electricity', 'water', 'broom', 'trash', 'lock',
  // saúde / cuidados
  'health', 'hospital', 'pharmacy', 'tooth', 'fitness', 'dumbbell', 'running', 'yoga', 'spa', 'scissors', 'makeup',
  // compras
  'shopping', 'tshirt', 'shoes', 'ring',
  // lazer / tecnologia
  'leisure', 'tech', 'phone', 'internet', 'wifi', 'tv', 'camera', 'music', 'movie', 'book', 'newspaper', 'beach', 'umbrella', 'star', 'heart', 'sparkles', 'gift',
  // pessoas / diversos
  'child', 'baby', 'dog', 'cat', 'pet', 'education', 'graduation', 'work', 'church', 'charity', 'calendar', 'subscription', 'pix',
])

/* Paths SVG remanescentes — viewBox 24. */
const PATHS = {
  arrowUp: <><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>,
  arrowDown: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
}

export function TransacaoCategoriaIcon({ categoriaNome, subcategoriaNome, isReceita, iconeOverride, size = 18, className }) {
  // Ícone escolhido pelo usuário (categoria.icone) tem precedência sobre a
  // resolução por nome. As 28 chaves válidas já estão em ICON_PNG.
  const resolved = iconeOverride || getTransacaoCategoriaIconKey(categoriaNome, subcategoriaNome)
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

// Ícones das metas — chaves salvas no campo `icone` (metas novas) + compat emoji.

export const META_ICON_KEYS = [
  'target', 'plane', 'house', 'car', 'ring', 'graduation',
  'beach', 'laptop', 'shield', 'gift', 'baby', 'money',
]

// Compat: metas antigas guardavam emoji em `icone`. Mapeia p/ a chave nova.
const EMOJI_TO_KEY = {
  '🎯': 'target', '✈️': 'plane', '🏠': 'house', '🚗': 'car', '💍': 'ring',
  '🎓': 'graduation', '🏖️': 'beach', '💻': 'laptop', '🛡️': 'shield',
  '🎁': 'gift', '👶': 'baby', '💰': 'money',
}

/** Resolve um valor salvo (chave nova ou emoji antigo) para a chave do ícone. */
export function metaIconKey(value) {
  if (value && META_ICON_KEYS.includes(value)) return value
  return EMOJI_TO_KEY[value] || 'target'
}

/**
 * Mapeamento de nome de instituição → chave do logo em /public/banks/{key}.png
 * Correspondência por substring normalizada (sem acento, minúsculo).
 */

const BANCO_MAP = [
  ['nubank', 'nubank'],
  ['itau', 'itau'],
  ['bradesco', 'bradesco'],
  ['santander', 'santander'],
  ['banco do brasil', 'bb'],
  ['caixa', 'caixa'],
  ['xp invest', 'xp'],
  ['btg', 'btg'],
  ['banco inter', 'inter'],
  ['inter invest', 'inter'],
  ['c6 bank', 'c6bank'],
  ['rico', 'rico'],
  ['clear', 'clear'],
  ['nu invest', 'nuinvest'],
  ['easynvest', 'nuinvest'],
  ['avenue', 'avenue'],
  ['sicoob', 'sicoob'],
  ['sicredi', 'sicredi'],
  ['mercado pago', 'mercadopago'],
  ['picpay', 'picpay'],
  ['pagbank', 'pagbank'],
  ['pagseguro', 'pagbank'],
  ['safra', 'safra'],
  ['warren', 'warren'],
  ['genial', 'genial'],
  ['modal mais', 'modalmais'],
  ['banco modal', 'modalmais'],
  ['orama', 'orama'],
  ['toro', 'toro'],
  ['guide', 'guide'],
  ['neon', 'neon'],
  ['stone', 'stone'],
  ['b3', 'b3'],
  ['daycoval', 'daycoval'],
  ['original', 'original'],
  ['banco pan', 'pan'],
  ['sofisa', 'sofisa'],
  ['creditas', 'creditas'],
  ['cora', 'cora'],
  ['agora', 'agora'],
  ['kinvo', 'kinvo'],
  ['nomad', 'nomad'],
  ['mercado bitcoin', 'mercadobitcoin'],
  ['rendimento', 'rendimento'],
  ['cresol', 'cresol'],
]

function normalizar(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Retorna o caminho do logo para uma instituição, ou null se não encontrado.
 * @param {string} nomeInstituicao
 * @returns {string|null}
 */
export function getLogoInstituicao(nomeInstituicao) {
  const norm = normalizar(nomeInstituicao)
  for (const [keyword, key] of BANCO_MAP) {
    if (norm.includes(normalizar(keyword))) {
      return `/banks/${key}.png`
    }
  }
  return null
}

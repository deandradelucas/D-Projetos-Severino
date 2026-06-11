import { getTransacaoCategoriaIconKey } from './transacaoCategoriaIconResolve.js'

/* Tradução das chaves históricas `*Png` do resolver para o nome do line-icon. */
export const CATEGORIA_ICON_ALIAS = {
  saldoPng: 'scale',
  transportePng: 'car',
  comprasVarejoPng: 'shopping',
  alimentacaoPng: 'utensils',
  cuidadosPessoaisPng: 'sparkles',
  despesasFinanceirasPng: 'percent',
  doacoesPresentesPng: 'gift',
  documentacaoImpostosPng: 'receipt',
  educacaoPng: 'education',
  investimentosPatrimonioPng: 'investment',
  lazerEntreterimentoPng: 'leisure',
  moradiaPng: 'home',
  petsDependentesPng: 'pet',
  rendaPrincipalPng: 'wallet',
  rendaExtraPng: 'coins',
  rendimentosBeneficiosPng: 'handCoins',
  receitasEventuaisPng: 'dollarCircle',
  rendasPjPng: 'building',
  saudePng: 'health',
  servicosAssinaturasPng: 'subscription',
  tecnologiaGadgetsPng: 'tech',
  trabalhoNegociosPng: 'work',
  viagensPng: 'plane',
  pixPng: 'pix',
}

/* Cor por categoria (estilo fintech — chip pastel + ícone na cor cheia).
 * Escolhida pelo CEO em 10-jun (prancheta icons-preview, opção B). */
export const COLOR_BY_ICON = {
  utensils: '#e8590c',
  fuel: '#e8590c',
  car: '#1971c2',
  home: '#5f3dc4',
  health: '#e03131',
  education: '#3b5bdb',
  leisure: '#9c36b5',
  shopping: '#d6336c',
  tech: '#0c8599',
  subscription: '#6741d9',
  fitness: '#2f9e44',
  receipt: '#868e96',
  pet: '#a87900',
  plane: '#1098ad',
  gift: '#d6336c',
  wallet: '#2f9e44',
  work: '#495057',
  investment: '#2f9e44',
  child: '#f08c00',
  bank: '#495057',
  sparkles: '#cc5de8',
  percent: '#e8590c',
  coins: '#f59f00',
  handCoins: '#2f9e44',
  dollarCircle: '#2f9e44',
  building: '#1971c2',
  scale: '#868e96',
  pix: '#0ca678',
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/**
 * Estilo do "chip" da categoria para o wrapper do consumidor (círculo da linha,
 * hero do modal). Estilo "duotone renderizado" (escolha do CEO em 10-jun):
 * gradiente suave na cor + sombra colorida (profundidade) + brilho superior.
 * Retorna null quando a transação não tem categoria reconhecida — o consumidor
 * mantém o visual padrão verde/vermelho de receita/despesa.
 */
export function getCategoriaIconChipStyle(categoriaNome, subcategoriaNome) {
  const resolved = getTransacaoCategoriaIconKey(categoriaNome, subcategoriaNome)
  if (!resolved) return null
  const cor = COLOR_BY_ICON[CATEGORIA_ICON_ALIAS[resolved] || resolved]
  if (!cor) return null
  return {
    color: cor,
    background: `linear-gradient(145deg, ${hexToRgba(cor, 0.20)}, ${hexToRgba(cor, 0.10)})`,
    boxShadow: `0 2px 5px ${hexToRgba(cor, 0.22)}, inset 0 1px 0 rgba(255, 255, 255, 0.35)`,
  }
}

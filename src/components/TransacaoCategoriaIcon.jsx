import { getTransacaoCategoriaIconKey } from '../lib/transacaoCategoriaIconResolve.js'

/**
 * Ícone da transação — line-icons SVG (estilo Lucide, stroke currentColor),
 * mesmo padrão visual do MetaIcon. Substituiu o sistema antigo (PNGs 3D +
 * fonte line-awesome): consistente, nítido em retina, herda a cor do tema
 * e tirou 89KB de fonte do caminho crítico.
 */

/* Paths Lucide (ISC license) — viewBox 24, stroke 2, currentColor. */
const PATHS = {
  // Alimentação — talheres
  utensils: <><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></>,
  // Combustível — bomba
  fuel: <><path d="M3 22h12" /><path d="M4 9h10" /><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" /><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" /></>,
  // Transporte — carro
  car: <><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></>,
  // Moradia — casa
  home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>,
  // Saúde — coração com pulso
  health: <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" /></>,
  // Educação — capelo
  education: <><path d="M21.4 10.9a1 1 0 0 0 0-1.83L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.9a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></>,
  // Lazer — claquete
  leisure: <><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" /><path d="m6.2 5.3 3.1 3.9" /><path d="m12.4 3.4 3.1 4" /><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
  // Compras — sacola
  shopping: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
  // Tecnologia — smartphone
  tech: <><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></>,
  // Assinaturas — cartão
  subscription: <><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></>,
  // Fitness — halteres
  fitness: <><path d="M14.4 14.4 9.6 9.6" /><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" /><path d="m21.5 21.5-1.4-1.4" /><path d="M3.9 3.9 2.5 2.5" /><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" /></>,
  // Impostos/documentação — recibo
  receipt: <><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17.5v-11" /></>,
  // Pets — pata
  pet: <><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" /></>,
  // Viagens — avião
  plane: <><path d="M14.5 21.7a.5.5 0 0 0 .94-.02l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.02.94l7.9 3.18a2 2 0 0 1 1.11 1.11z" /><path d="m21.85 2.15-10.94 10.94" /></>,
  // Presentes/doações
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C9 3 12 8 12 8s3-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>,
  // Renda principal — carteira
  wallet: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  // Trabalho — maleta
  work: <><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" /></>,
  // Investimentos — gráfico em alta
  investment: <><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" /></>,
  // Filhos/dependentes — bebê
  child: <><path d="M9 12h.01" /><path d="M15 12h.01" /><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M17.6 6.4a9 9 0 1 1-11.2 0" /><path d="M12 2c1.5 0 3 1 3 2.5S13.5 7 12.5 7" /></>,
  // Banco — prédio clássico
  bank: <><path d="M3 22h18" /><path d="M6 18v-7" /><path d="M10 18v-7" /><path d="M14 18v-7" /><path d="M18 18v-7" /><path d="m12 2 8 5H4Z" /></>,
  // Cuidados pessoais — brilho
  sparkles: <><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /></>,
  // Despesas financeiras — percentual
  percent: <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="M9 9h.01" /><path d="M15 15h.01" /></>,
  // Renda extra — moedas
  coins: <><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /></>,
  // Rendimentos/benefícios — mão com moeda
  handCoins: <><path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" /><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" /><path d="m2 16 6 6" /><circle cx="16" cy="9" r="2.9" /><circle cx="6" cy="5" r="3" /></>,
  // Receitas eventuais — cifrão
  dollarCircle: <><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></>,
  // Rendas PJ — prédio comercial
  building: <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></>,
  // Saldo — balança
  scale: <><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></>,
  // Pix — losango característico
  pix: <><rect x="8.4" y="8.4" width="7.2" height="7.2" rx="1.6" transform="rotate(45 12 12)" /><path d="M12 5.2v1.6" /><path d="M12 17.2v1.6" /><path d="M5.2 12h1.6" /><path d="M17.2 12h1.6" /></>,
  arrowUp: <><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>,
  arrowDown: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
}

/* As chaves `*Png` do resolver (nome histórico — eram PNGs) apontam para o
 * line-icon temático da categoria. O resolver fica intacto (53 testes). */
const ALIAS = {
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
const COLOR_BY_ICON = {
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
 * Estilo do "chip" da categoria (fundo pastel + cor do ícone) para o wrapper
 * do consumidor (círculo da linha, hero do modal etc.). Retorna null quando a
 * transação não tem categoria reconhecida — o consumidor mantém o visual
 * padrão verde/vermelho de receita/despesa.
 */
export function getCategoriaIconChipStyle(categoriaNome, subcategoriaNome) {
  const resolved = getTransacaoCategoriaIconKey(categoriaNome, subcategoriaNome)
  if (!resolved) return null
  const cor = COLOR_BY_ICON[ALIAS[resolved] || resolved]
  if (!cor) return null
  return { color: cor, background: hexToRgba(cor, 0.13) }
}

export function TransacaoCategoriaIcon({ categoriaNome, subcategoriaNome, isReceita, size = 16, className }) {
  const resolved = getTransacaoCategoriaIconKey(categoriaNome, subcategoriaNome)
  const mapKey = resolved ?? (isReceita ? 'arrowUp' : 'arrowDown')
  const paths = PATHS[ALIAS[mapKey] || mapKey] || PATHS[isReceita ? 'arrowUp' : 'arrowDown']

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  )

  return className ? <span className={className}>{icon}</span> : icon
}

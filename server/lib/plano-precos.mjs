// Fonte ÚNICA dos preços do plano (mensal/anual).
// Antes, o preço era lido em 8 pontos via process.env.HORIZONTE_PLANO_PRECO com
// fallback DIVERGENTE ('10' em 7 lugares, '19.90' em marketing-stats), gerando
// risco de MRR/receita inconsistente quando a env var não estivesse definida.
// Aqui o fallback é canônico e o parsing é robusto (NaN/<=0 -> padrão).

const PRECO_MENSAL_PADRAO = 10
const PRECO_ANUAL_PADRAO = 100

function parsePrecoPositivo(raw, padrao) {
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : padrao
}

/** Preço mensal do plano (R$). */
export function getPrecoMensal() {
  return parsePrecoPositivo(process.env.HORIZONTE_PLANO_PRECO, PRECO_MENSAL_PADRAO)
}

/** Preço anual do plano (R$). */
export function getPrecoAnual() {
  return parsePrecoPositivo(process.env.HORIZONTE_PLANO_PRECO_ANUAL, PRECO_ANUAL_PADRAO)
}

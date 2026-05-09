/**
 * Lista para pesquisa em “Banco ou corretora” (cadastro de investimentos).
 * Não é cadastro oficial BACEN — apenas nomes usuais na UI.
 * @typedef {{ nome: string, tipo: 'banco' | 'cooperativa' | 'fintech' | 'corretora' }} InstituicaoRow
 */

/** @type {InstituicaoRow[]} */
const RAW = [
  { nome: 'Ágora Investimentos', tipo: 'corretora' },
  { nome: 'Avenue Securities', tipo: 'corretora' },
  { nome: 'Banco ABC Brasil', tipo: 'banco' },
  { nome: 'Banco BTG Pactual', tipo: 'banco' },
  { nome: 'Banco Bradesco', tipo: 'banco' },
  { nome: 'Banco Citibank', tipo: 'banco' },
  { nome: 'Ailos Cooperativa', tipo: 'cooperativa' },
  { nome: 'Banco da Amazônia (BASA)', tipo: 'banco' },
  { nome: 'Banco Daycoval', tipo: 'banco' },
  { nome: 'Banco do Brasil', tipo: 'banco' },
  { nome: 'Banco do Nordeste (BNB)', tipo: 'banco' },
  { nome: 'Banco Genial', tipo: 'banco' },
  { nome: 'Banco Inter', tipo: 'banco' },
  { nome: 'Banco Modal', tipo: 'banco' },
  { nome: 'Banco Original', tipo: 'banco' },
  { nome: 'Banco PAN', tipo: 'banco' },
  { nome: 'Banco Pine', tipo: 'banco' },
  { nome: 'Banco Rabobank Brasil', tipo: 'banco' },
  { nome: 'Banco Rendimento', tipo: 'banco' },
  { nome: 'Banco Safra', tipo: 'banco' },
  { nome: 'Banco Santander', tipo: 'banco' },
  { nome: 'Banco Sofisa Direto', tipo: 'banco' },
  { nome: 'Banco Votorantim', tipo: 'banco' },
  { nome: 'Banestes', tipo: 'banco' },
  { nome: 'Banpara', tipo: 'banco' },
  { nome: 'Banrisul', tipo: 'banco' },
  { nome: 'BRB — Banco de Brasília', tipo: 'banco' },
  { nome: 'BTG Pactual Investimentos', tipo: 'corretora' },
  { nome: 'C6 Bank', tipo: 'fintech' },
  { nome: 'Caixa Econômica Federal', tipo: 'banco' },
  { nome: 'Clear Corretora', tipo: 'corretora' },
  { nome: 'Cora Sociedade de Crédito', tipo: 'fintech' },
  { nome: 'Cresol Confederação', tipo: 'cooperativa' },
  { nome: 'Creditas Bank', tipo: 'fintech' },
  { nome: 'Elite Investimentos', tipo: 'corretora' },
  { nome: 'Genial Investimentos', tipo: 'corretora' },
  { nome: 'Guide Investimentos', tipo: 'corretora' },
  { nome: 'Inter Invest', tipo: 'corretora' },
  { nome: 'Itaú Corretora', tipo: 'corretora' },
  { nome: 'Itaú Unibanco', tipo: 'banco' },
  { nome: 'Kinvo', tipo: 'corretora' },
  { nome: 'Mercado Bitcoin', tipo: 'corretora' },
  { nome: 'Mercado Pago', tipo: 'fintech' },
  { nome: 'Mirae Asset Wealth Management', tipo: 'corretora' },
  { nome: 'Modal Mais', tipo: 'corretora' },
  { nome: 'Neon Pagamentos', tipo: 'fintech' },
  { nome: 'Nomad Global', tipo: 'corretora' },
  { nome: 'Nubank', tipo: 'fintech' },
  { nome: 'Nu Invest (Easynvest)', tipo: 'corretora' },
  { nome: 'Órama Investimentos', tipo: 'corretora' },
  { nome: 'PagBank / PagSeguro', tipo: 'fintech' },
  { nome: 'PicPay Bank', tipo: 'fintech' },
  { nome: 'Rico Investimentos', tipo: 'corretora' },
  { nome: 'Santander Corretora', tipo: 'corretora' },
  { nome: 'Sicoob (Sistema de Cooperativas)', tipo: 'cooperativa' },
  { nome: 'Sicredi', tipo: 'cooperativa' },
  { nome: 'Stone Co', tipo: 'fintech' },
  { nome: 'SumUp', tipo: 'fintech' },
  { nome: 'Toro Investimentos', tipo: 'corretora' },
  { nome: 'Unicred', tipo: 'cooperativa' },
  { nome: 'Warren Investimentos', tipo: 'corretora' },
  { nome: 'Will Bank', tipo: 'fintech' },
  { nome: 'XP Investimentos', tipo: 'corretora' },
  { nome: 'Ágora — Bradesco', tipo: 'corretora' },
  { nome: 'B3 (Bolsa)', tipo: 'corretora' },
  { nome: 'Banco BS2', tipo: 'banco' },
  { nome: 'Banco Digio', tipo: 'fintech' },
  { nome: 'Banco Honda', tipo: 'banco' },
  { nome: 'Banco Master', tipo: 'banco' },
  { nome: 'Banco Mercantil do Brasil', tipo: 'banco' },
  { nome: 'Banco Paulista', tipo: 'banco' },
  { nome: 'Banco Triângulo', tipo: 'banco' },
  { nome: 'BM&C Corretora', tipo: 'corretora' },
  { nome: 'BR Partners', tipo: 'corretora' },
  { nome: 'CM Capital Markets', tipo: 'corretora' },
  { nome: 'Coinbase Brasil', tipo: 'corretora' },
  { nome: 'Commit Capital', tipo: 'corretora' },
  { nome: 'Credisis', tipo: 'cooperativa' },
  { nome: 'FacilitaPay', tipo: 'fintech' },
  { nome: 'Fidelity Brokerage', tipo: 'corretora' },
  { nome: 'Genial Institucional', tipo: 'corretora' },
  { nome: 'Global Securities', tipo: 'corretora' },
  { nome: 'Goldman Sachs Brasil', tipo: 'corretora' },
  { nome: 'Ideal Investimentos', tipo: 'corretora' },
  { nome: 'Ingresse Securities', tipo: 'corretora' },
  { nome: 'Inteligo Investimentos', tipo: 'corretora' },
  { nome: 'Invest Securities', tipo: 'corretora' },
  { nome: 'IQ Option', tipo: 'corretora' },
  { nome: 'Iti Itaú', tipo: 'fintech' },
  { nome: 'J.P. Morgan Private Bank', tipo: 'banco' },
  { nome: 'Jeitto', tipo: 'fintech' },
  { nome: 'Magnetis', tipo: 'corretora' },
  { nome: 'MS Investimentos', tipo: 'corretora' },
  { nome: 'Nova Futura Investimentos', tipo: 'corretora' },
  { nome: 'Ótimo Sociedade de Crédito', tipo: 'fintech' },
  { nome: 'Planner Corretora', tipo: 'corretora' },
  { nome: 'Plural Investimentos', tipo: 'corretora' },
  { nome: 'Porto Seguro Investimentos', tipo: 'corretora' },
  { nome: 'Renascença Distribuidora', tipo: 'corretora' },
  { nome: 'Safra Investimentos', tipo: 'corretora' },
  { nome: 'Singulare Corretora', tipo: 'corretora' },
  { nome: 'Spinelli', tipo: 'corretora' },
  { nome: 'Terra Investimentos', tipo: 'corretora' },
  { nome: 'Tullet Prebon Brasil', tipo: 'corretora' },
  { nome: 'UBS Brasil', tipo: 'corretora' },
  { nome: 'Unión de Créditos', tipo: 'corretora' },
  { nome: 'Vitreo Corretora', tipo: 'corretora' },
  { nome: 'Wa Capital', tipo: 'corretora' },
  { nome: 'Yellow Investimentos', tipo: 'corretora' },
  { nome: 'Zero Markets', tipo: 'corretora' },
]

function normalizeBusca(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** Lista ordenada (imutável) para a UI */
export const INSTITUICOES_FINANCEIRAS = Object.freeze(
  [...RAW].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
)

/**
 * @param {string} query
 * @param {number} [limit]
 * @returns {InstituicaoRow[]}
 */
export function filtrarInstituicoesFinanceiras(query, limit = 48) {
  const q = normalizeBusca(query)
  if (!q) return INSTITUICOES_FINANCEIRAS.slice(0, limit)
  const out = []
  for (const row of INSTITUICOES_FINANCEIRAS) {
    if (normalizeBusca(row.nome).includes(q)) {
      out.push(row)
      if (out.length >= limit) break
    }
  }
  return out
}

export function labelTipoInstituicao(tipo) {
  const m = { banco: 'Banco', cooperativa: 'Cooperativa', fintech: 'Fintech', corretora: 'Corretora' }
  return m[tipo] || tipo
}

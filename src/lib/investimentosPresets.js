/** Opções fixas do cadastro de investimentos (chave enviada à API como `preset`). */
export const INVESTIMENTOS_PRESETS_LIST = [
  { key: 'LCA', label: 'LCA', hint: 'Letra de Crédito do Agronegócio · isenta IR' },
  { key: 'LCI', label: 'LCI', hint: 'Letra de Crédito Imobiliário · isenta IR' },
  { key: 'CRI', label: 'CRI', hint: 'Recebíveis Imobiliários · isento IR' },
  { key: 'CRA', label: 'CRA', hint: 'Recebíveis Agro · isento IR' },
  { key: 'CDB', label: 'CDB', hint: 'Certificado de Depósito Bancário' },
  { key: 'CDI', label: 'CDI', hint: 'Taxa referência' },
  { key: 'DEBENTURE', label: 'Debênture', hint: 'Incentivada · isenta IR (PF)' },
  { key: 'TESOURO_SELIC', label: 'Tesouro Selic', hint: 'Acompanha a SELIC · ~100% CDI' },
  { key: 'POUPANCA', label: 'Poupança', hint: '70% SELIC · isenta IR (PF)' },
]

/**
 * Utilitários puros para a página de Relatórios.
 * Extraído de Relatorios.jsx para reduzir o tamanho do arquivo.
 */

/**
 * Formata um valor como percentual br-BR em relação ao total.
 * @param {number} value
 * @param {number} total
 * @returns {string}
 */
export function formatPctBr(value, total) {
  if (!total || total <= 0) return '0%'
  const pct = (Number(value) / total) * 100
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`
}

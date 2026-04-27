/**
 * Retorna a data no formato YYYY-MM-DD respeitando o fuso horário local.
 * Evita o bug do toISOString() que pode retornar o dia anterior/posterior dependendo do horário.
 * @param {Date} date 
 * @returns {string}
 */
export const formatLocalDateISO = (date) => {
  if (!(date instanceof Date) || isNaN(date)) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Retorna o primeiro dia do mês atual.
 */
export const getFirstDayOfMonth = (date = new Date()) => {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Retorna o último dia do mês atual.
 */
export const getLastDayOfMonth = (date = new Date()) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

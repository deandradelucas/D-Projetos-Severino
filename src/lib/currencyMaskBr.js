/**
 * Máscara monetária pt-BR enquanto digita (centavos nos dois últimos dígitos),
 * alinhada ao fluxo de valor em transações.
 */

const MAX_DIGITS = 14

/**
 * @param {string} raw valor atual do input (pode conter pontuação)
 * @returns {string} texto só com dígitos ou string vazia
 */
export function digitsOnlyCurrency(raw) {
  return String(raw ?? '').replace(/\D/g, '')
}

/**
 * @param {string} digitsOnly apenas dígitos (sem vazio)
 * @returns {string} ex. "1.234,56" — sem símbolo R$
 */
export function formatBRLFromDigits(digitsOnly) {
  const d = digitsOnly.length > MAX_DIGITS ? digitsOnly.slice(0, MAX_DIGITS) : digitsOnly
  const n = parseInt(d, 10) / 100
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/**
 * Atualiza o campo a partir do que o utilizador escreveu (cola, teclado).
 * @param {string} raw
 * @returns {string} mascarado ou "" se não há dígitos
 */
export function maskCurrencyBRLInput(raw) {
  const digits = digitsOnlyCurrency(raw)
  if (digits === '') return ''
  return formatBRLFromDigits(digits)
}

/**
 * Interpreta o texto mascarado como número em reais (2 casas).
 * @param {string} masked
 * @returns {number}
 */
export function parseCurrencyBRLMasked(masked) {
  let digits = digitsOnlyCurrency(masked)
  if (!digits) return NaN
  if (digits.length > MAX_DIGITS) digits = digits.slice(0, MAX_DIGITS)
  const n = parseInt(digits, 10) / 100
  return Math.round(n * 100) / 100
}

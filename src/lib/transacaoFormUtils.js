// Helpers puros do formulário de transação (TransactionModal) — sem React.

/** Compara dois "tipos" de categoria de forma case/trim-insensitive. */
export function tipoCategoriaIgual(tipoCampo, tipoAlvo) {
  return String(tipoCampo ?? '').trim().toUpperCase() === String(tipoAlvo ?? '').trim().toUpperCase()
}

/** Categorias do tipo selecionado, ordenadas por nome (pt, base). */
export function filtrarCategoriasPorTipo(categorias, tipo) {
  return [...categorias]
    .filter((c) => tipoCategoriaIgual(c.tipo, tipo))
    .sort((a, b) =>
      String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt', { sensitivity: 'base' })
    )
}

/**
 * Avalia uma expressão aritmética simples da calculadora inline.
 * Normaliza símbolos (× ÷ − e vírgula BR), só aceita dígitos/operadores/parênteses,
 * e retorna número arredondado a 2 casas — ou null se inválida.
 */
export function safeEvalExpression(expr) {
  const norm = String(expr)
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '.')
  if (!/^[\d\s+\-*/().]+$/.test(norm)) return null
  try {
    const fn = new Function(`"use strict"; return (${norm});`)
    const val = fn()
    if (typeof val !== 'number' || !Number.isFinite(val)) return null
    return Math.round(val * 100) / 100
  } catch {
    return null
  }
}

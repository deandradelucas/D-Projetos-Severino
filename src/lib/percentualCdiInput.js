/**
 * Interpreta % do CDI contratado (pt-BR ou número JSON), alinhado ao servidor.
 * @param {unknown} raw
 * @returns {number}
 */
export function parsePercentualCdiInput(raw) {
  if (raw === undefined || raw === null || raw === '') {
    throw new Error('Informe o percentual do CDI contratado.')
  }
  if (typeof raw === 'number') {
    const rounded = Math.round(raw * 100) / 100
    if (!Number.isFinite(rounded)) throw new Error('Percentual do CDI inválido.')
    if (rounded < 0.01) throw new Error('Percentual do CDI deve ser no mínimo 0,01%.')
    if (rounded > 9999.99) throw new Error('Percentual do CDI acima do limite permitido.')
    return rounded
  }
  const s = String(raw)
    .trim()
    .replace(/%/g, '')
    .replace(/\s/g, '')
  if (!s) throw new Error('Informe o percentual do CDI contratado.')
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalized)
  if (!Number.isFinite(n)) throw new Error('Percentual do CDI inválido.')
  const rounded = Math.round(n * 100) / 100
  if (rounded < 0.01) throw new Error('Percentual do CDI deve ser no mínimo 0,01%.')
  if (rounded > 9999.99) throw new Error('Percentual do CDI acima do limite permitido.')
  return rounded
}

/**
 * @param {unknown} value valor gravado (API)
 * @returns {string | null} texto para UI
 */
export function formatPercentualCdiLista(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
}

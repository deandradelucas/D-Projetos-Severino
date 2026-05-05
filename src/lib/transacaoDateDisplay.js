/** Interpreta `data_transacao` (YYYY-MM-DD ou ISO) sem deslocar o dia no fuso local. */
export function parseTransacaoDate(raw) {
  if (raw == null || raw === '') return new Date(NaN)
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d, 12, 0, 0)
  }
  return new Date(s)
}

/**
 * Texto da lista (data + hora quando disponível) e atributo `dateTime` para <time>.
 */
export function formatTransacaoListDateTime(raw) {
  const dt = parseTransacaoDate(raw)
  if (Number.isNaN(dt.getTime())) return { line: '—', dateTimeAttr: undefined }
  const s = String(raw).trim()
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s)
  const datePart = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  if (dateOnly) {
    return { line: datePart, dateTimeAttr: s }
  }
  const timePart = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return { line: `${datePart} · ${timePart}`, dateTimeAttr: dt.toISOString() }
}

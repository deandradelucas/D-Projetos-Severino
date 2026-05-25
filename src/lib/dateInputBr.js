/** Entrada de data no formato brasileiro dd/mm/aaaa ↔ yyyy-mm-dd (ISO). */

export function ymdToDdMmYyyy(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd).trim())) return ''
  const [y, m, d] = String(ymd).trim().split('-')
  return `${d}/${m}/${y}`
}

/**
 * Aceita só datas completas e válidas no calendário gregoriano.
 * @param {string} s
 * @returns {string | null} yyyy-mm-dd ou null
 */
export function parseDdMmYyyyStrict(s) {
  const t = String(s).trim()
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Mantém só dígitos e barras na posição fixa (até 8 dígitos → dd/mm/aaaa). */
export function maskDateBrInput(raw) {
  const digits = String(raw).replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** Data local do utilizador em yyyy-mm-dd */
export function todayYmdLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Comparação lexicográfica segura para yyyy-mm-dd */
export function compareYmd(a, b) {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

/** yyyy-mm-dd a partir de componentes de calendário (monthIndex 0–11) */
export function ymdFromCalendarParts(year, monthIndex, day) {
  const dt = new Date(year, monthIndex, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== monthIndex || dt.getDate() !== day) return null
  const m = String(monthIndex + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}


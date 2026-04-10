/**
 * Exibe telefone BR de forma legível quando só há dígitos (10/11 ou com 55).
 * Se não reconhecer, devolve o texto original.
 */
export function formatPhoneBRDisplay(raw) {
  if (raw == null || raw === '') return '—'
  const s = String(raw).trim()
  if (!s) return '—'
  const d = s.replace(/\D/g, '')
  if (d.length < 10) return s

  let n = d
  if (n.length >= 12 && n.startsWith('55')) {
    n = n.slice(2)
  }
  if (n.length === 11) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  }
  if (n.length === 10) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  }
  return s
}

/**
 * Máscara de celular BR: (DD) 9XXXX-XXXX (até 11 dígitos).
 */
export function maskPhoneBRMobile(raw) {
  const numbers = String(raw ?? '').replace(/\D/g, '').slice(0, 11)
  if (numbers.length <= 2) return numbers.length ? `(${numbers}` : ''
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}

export function digitsOnlyPhoneBR(raw) {
  return String(raw ?? '').replace(/\D/g, '')
}

/**
 * Valida celular BR (DDD + 9 dígitos).
 * @returns {{ ok: true, digits: string } | { ok: false, message: string }}
 */
export function validatePhoneBRMobile(raw) {
  const digits = digitsOnlyPhoneBR(raw)
  if (digits.length !== 11) {
    return { ok: false, message: 'Informe celular com DDD (11 dígitos).' }
  }
  if (digits[2] !== '9') {
    return { ok: false, message: 'Informe um número de celular (9 após o DDD).' }
  }
  return { ok: true, digits }
}

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

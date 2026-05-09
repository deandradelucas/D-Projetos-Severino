export function maskCpfCnpj(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function validarCpf(d) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const dig = (s, n) => {
    let sum = 0
    for (let i = 0; i < n; i++) sum += +s[i] * (n + 1 - i)
    const r = (sum * 10) % 11
    return r >= 10 ? 0 : r
  }
  return dig(d, 9) === +d[9] && dig(d, 10) === +d[10]
}

function validarCnpj(d) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const dig = (s, len) => {
    let sum = 0
    let pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += +s[len - i] * pos--
      if (pos < 2) pos = 9
    }
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return dig(d, 12) === +d[12] && dig(d, 13) === +d[13]
}

export function validateCpfCnpj(value) {
  const d = String(value).replace(/\D/g, '')
  if (d.length === 11) return validarCpf(d)
  if (d.length === 14) return validarCnpj(d)
  return false
}

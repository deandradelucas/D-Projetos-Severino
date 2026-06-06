// Validação de dígito verificador (módulo 11) de CPF e CNPJ. Evita enviar
// documentos inválidos ao Asaas (que retornaria 500) e clientes "sujos".

function isValidCpf(cpf) {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i)
  let d1 = (sum * 10) % 11
  if (d1 === 10) d1 = 0
  if (d1 !== Number(cpf[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i)
  let d2 = (sum * 10) % 11
  if (d2 === 10) d2 = 0
  return d2 === Number(cpf[10])
}

function isValidCnpj(cnpj) {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const dig = (len) => {
    const weights = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cnpj[i]) * weights[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return dig(12) === Number(cnpj[12]) && dig(13) === Number(cnpj[13])
}

/** Valida CPF (11) ou CNPJ (14) pelos dígitos verificadores. Aceita com ou sem máscara. */
export function isValidCpfCnpj(value) {
  const d = String(value || '').replace(/\D/g, '')
  if (d.length === 11) return isValidCpf(d)
  if (d.length === 14) return isValidCnpj(d)
  return false
}

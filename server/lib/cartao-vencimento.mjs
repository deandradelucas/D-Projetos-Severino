// Cálculo das datas de vencimento das parcelas de uma compra no cartão (backend).
// Espelha src/lib/cartaoVencimento.js — mesma regra para front e back:
// a 1ª parcela vence no PRÓXIMO dia de vencimento do cartão a partir da data da compra
// (ignora o ciclo de fechamento). Ex.: compra 17/04 + vencimento dia 10 → 1ª vence 10/05.

function clampDay(year, monthIdx, day) {
  const last = new Date(year, monthIdx + 1, 0).getDate()
  return Math.min(Math.max(1, day), last)
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseLocalDate(input) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(input || ''))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Data da 1ª parcela: primeiro dia de vencimento >= data da compra.
function primeiroVencimento(dataCompra, diaVenc) {
  const d = parseLocalDate(dataCompra)
  const venc = Number(diaVenc)
  if (!d || !Number.isFinite(venc) || venc < 1) return null
  let y = d.getFullYear()
  let mo = d.getMonth()
  let v = new Date(y, mo, clampDay(y, mo, venc))
  if (v < d) {
    mo += 1
    v = new Date(y, mo, clampDay(y, mo, venc))
  }
  return v
}

/**
 * Data de vencimento (YYYY-MM-DD) de uma parcela da compra.
 * @param {string} dataCompra - 'YYYY-MM-DD' ou ISO
 * @param {number} diaVencimento - dia_vencimento do cartão (1-31)
 * @param {number} [indiceParcela=0] - 0 = 1ª parcela
 * @returns {string} 'YYYY-MM-DD' ou '' se inválido
 */
export function vencimentoCartaoParaData(dataCompra, diaVencimento, indiceParcela = 0) {
  const base = primeiroVencimento(dataCompra, diaVencimento)
  if (!base) return ''
  const venc = Number(diaVencimento)
  const mo = base.getMonth() + (Number(indiceParcela) || 0)
  const y = base.getFullYear()
  return ymd(new Date(y, mo, clampDay(y, mo, venc)))
}

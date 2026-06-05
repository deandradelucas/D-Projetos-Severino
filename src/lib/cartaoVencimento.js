// Cálculo das datas de vencimento das parcelas de uma compra no cartão.
//
// Regra (definida pelo CEO): a 1ª parcela vence no PRÓXIMO dia de vencimento do
// cartão a partir da data da compra (ignora o ciclo de fechamento).
// Ex.: compra 17/04 + vencimento dia 10 → 1ª parcela vence 10/05.
// As parcelas seguintes vencem no mesmo dia nos meses subsequentes.

function clampDay(year, monthIdx, day) {
  const last = new Date(year, monthIdx + 1, 0).getDate()
  return Math.min(Math.max(1, day), last)
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Aceita 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:mm' — parse local (sem timezone shift).
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

function ymdHoje() {
  return ymd(new Date())
}

/**
 * Data de vencimento de uma parcela da compra.
 * @param {string} dataCompra - 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:mm'
 * @param {number} diaVencimento - dia_vencimento do cartão (1-31)
 * @param {number} [mesesAdicionais=0] - índice da parcela (0 = 1ª)
 * @returns {string} 'YYYY-MM-DD' ou '' se entrada inválida
 */
export function vencimentoCartaoParaData(dataCompra, diaVencimento, mesesAdicionais = 0) {
  const base = primeiroVencimento(dataCompra, diaVencimento)
  if (!base) return ''
  const venc = Number(diaVencimento)
  const mo = base.getMonth() + (Number(mesesAdicionais) || 0)
  const y = base.getFullYear()
  return ymd(new Date(y, mo, clampDay(y, mo + 0, venc)))
}

/**
 * Para uma compra parcelada num cartão, calcula em qual parcela o lançamento deve
 * começar (parcelas com vencimento anterior a hoje são consideradas já pagas) e a
 * data de vencimento dessa parcela.
 *
 * Ex.: compra 17/04, vence dia 10, hoje 04/06 → 1ª (10/05) já venceu → { parcelaInicial: 2, dataPagamento: '2026-06-10' }.
 *
 * @param {string} dataCompra - 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:mm'
 * @param {number} diaVencimento
 * @param {number} numParcelas - total de parcelas
 * @param {string} [hojeYmd] - data de referência 'YYYY-MM-DD' (default: hoje) — injetável p/ teste
 * @returns {{ parcelaInicial: number, dataPagamento: string }}
 */
export function calcularParcelaAtual(dataCompra, diaVencimento, numParcelas, hojeYmd = ymdHoje()) {
  const num = Math.max(1, Number(numParcelas) || 1)
  if (!vencimentoCartaoParaData(dataCompra, diaVencimento, 0)) {
    return { parcelaInicial: 1, dataPagamento: '' }
  }
  let pagas = 0
  for (let i = 0; i < num; i++) {
    const vi = vencimentoCartaoParaData(dataCompra, diaVencimento, i)
    // vencimentos são crescentes; ao achar o 1º ainda não vencido, para.
    if (vi < hojeYmd) pagas++
    else break
  }
  const parcelaInicial = Math.min(num, pagas + 1)
  const dataPagamento = vencimentoCartaoParaData(dataCompra, diaVencimento, parcelaInicial - 1)
  return { parcelaInicial, dataPagamento }
}

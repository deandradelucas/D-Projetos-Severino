/**
 * Helpers para sugestão "meta × carteira" no modal de investimento (valores ilustrativos).
 */

export function diasCorridosEntreYmd(startYmd, endYmd) {
  if (
    !startYmd ||
    !endYmd ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(startYmd)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(endYmd))
  ) {
    return null
  }
  const d0 = new Date(`${startYmd}T12:00:00`)
  const d1 = new Date(`${endYmd}T12:00:00`)
  const ms = d1.getTime() - d0.getTime()
  if (!(ms > 0)) return null
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

/**
 * Taxa anual equivalente (composta, base 365 dias corridos) para multiplicar o principal pelo fator no prazo.
 * multiplo = valorMeta / valorBase (ex.: 3 para triplicar).
 */
export function taxaAnualEquivalenteParaMultiplo(multiplo, diasCorridos) {
  if (!Number.isFinite(multiplo) || multiplo <= 0) return null
  if (!Number.isFinite(diasCorridos) || diasCorridos <= 0) return null
  const r = multiplo ** (365 / diasCorridos) - 1
  if (!Number.isFinite(r)) return null
  return 100 * r
}

/** Crescimento linear médio por dia: (base × (multiplo − 1)) / dias */
export function deltaPatrimonialMedioDiarioLinear(valorBase, multiploMeta, diasCorridos) {
  if (!Number.isFinite(valorBase) || valorBase <= 0) return null
  if (!Number.isFinite(multiploMeta) || multiploMeta <= 0) return null
  if (!Number.isFinite(diasCorridos) || diasCorridos <= 0) return null
  const d = (valorBase * (multiploMeta - 1)) / diasCorridos
  return Number.isFinite(d) ? d : null
}

export function clampMultiplicadorMeta(v, min = 1, max = 50) {
  const n = Number(v)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

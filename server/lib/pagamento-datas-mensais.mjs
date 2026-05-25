// @ts-check
/** Helpers de âncora mensal (legado MP / próxima cobrança) — usados em testes e reutilizáveis. */

/** Mesmo dia no mês calendário seguinte (UTC); clamp ao último dia do mês (ex.: 31 jan → 28/29 fev). */
export function shiftToFollowingCalendarMonth(d) {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  const h = d.getUTCHours()
  const mi = d.getUTCMinutes()
  const s = d.getUTCSeconds()
  const ms = d.getUTCMilliseconds()
  const nm = m + 1
  const lastDom = new Date(Date.UTC(y, nm + 1, 0)).getUTCDate()
  const dom = Math.min(day, lastDom)
  return new Date(Date.UTC(y, nm, dom, h, mi, s, ms))
}

/** Garante data estritamente futura, avançando mês a mês (teto 24 iterações). */
export function ensureFutureMonthlyAnchor(d, now) {
  let out = new Date(d.getTime())
  let guard = 0
  while (out.getTime() <= now.getTime() && guard < 24) {
    out = shiftToFollowingCalendarMonth(out)
    guard += 1
  }
  return out
}

/**
 * Próxima cobrança após compra: no mês seguinte enquanto não há cobrança recorrente registrada (charged_quantity === 0).
 * @param {{ summarized?: { charged_quantity?: number } }} pre
 */
export function normalizarProximaCobrancaMensal(pre, nextIso) {
  if (!nextIso) return null
  const next = new Date(nextIso)
  if (Number.isNaN(next.getTime())) return null
  const now = new Date()
  const charged = Number(pre?.summarized?.charged_quantity ?? 0)
  if (charged > 0) {
    if (next.getTime() <= now.getTime()) return ensureFutureMonthlyAnchor(next, now).toISOString()
    return next.toISOString()
  }
  const sameMonth =
    next.getUTCFullYear() === now.getUTCFullYear() && next.getUTCMonth() === now.getUTCMonth()
  let out = sameMonth ? shiftToFollowingCalendarMonth(next) : next
  if (out.getTime() <= now.getTime()) out = ensureFutureMonthlyAnchor(out, now)
  return out.toISOString()
}

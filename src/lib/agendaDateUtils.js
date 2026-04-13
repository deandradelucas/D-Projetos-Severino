/** @param {Date} d */
export function cloneDate(d) {
  return new Date(d.getTime())
}

/** Primeiro dia da semana (segunda-feira) que contém `d` */
export function startOfWeekMonday(d) {
  const x = cloneDate(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

export function addDays(d, n) {
  const x = cloneDate(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMonths(d, n) {
  const x = cloneDate(d)
  x.setMonth(x.getMonth() + n)
  return x
}

export function startOfMonth(d) {
  const x = cloneDate(d)
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfMonth(d) {
  const x = startOfMonth(d)
  x.setMonth(x.getMonth() + 1)
  x.setDate(0)
  x.setHours(23, 59, 59, 999)
  return x
}

/** Chave yyyy-mm-dd local */
export function toDateKey(d) {
  const x = cloneDate(d)
  x.setHours(12, 0, 0, 0)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Grade do mês: semanas começando na segunda; ~6 semanas.
 * @param {Date} monthAnyDay
 * @returns {{ date: Date, inMonth: boolean, key: string }[]}
 */
export function buildMonthGrid(monthAnyDay) {
  const so = startOfMonth(monthAnyDay)
  const gridStart = startOfWeekMonday(so)
  const cells = []
  let cur = cloneDate(gridStart)
  for (let i = 0; i < 42; i++) {
    const inMonth = cur.getMonth() === monthAnyDay.getMonth()
    cells.push({ date: cloneDate(cur), inMonth, key: toDateKey(cur) })
    cur = addDays(cur, 1)
  }
  return cells
}

/** Intervalo da semana [segunda, domingo] */
export function weekRange(weekAnchor) {
  const start = startOfWeekMonday(weekAnchor)
  const end = addDays(start, 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** Intervalo do dia */
export function dayRange(day) {
  const start = cloneDate(day)
  start.setHours(0, 0, 0, 0)
  const end = cloneDate(day)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

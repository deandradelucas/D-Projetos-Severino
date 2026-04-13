import { formatCurrencyBRL } from './formatCurrency'

/** Resposta da API admin (formato atual). */
export function normalizePaymentLogsResponse(data) {
  if (Array.isArray(data)) {
    return { rows: data, summary: null }
  }
  if (data && typeof data === 'object') {
    return {
      rows: Array.isArray(data.rows) ? data.rows : [],
      summary: data.summary && typeof data.summary === 'object' ? data.summary : null,
    }
  }
  return { rows: [], summary: null }
}

export function buildPaymentLogsQuery(params) {
  const sp = new URLSearchParams()
  const limit = Math.min(800, Math.max(1, Number(params.limit) || 500))
  sp.set('limit', String(limit))
  if (params.statusGroup && params.statusGroup !== 'all') sp.set('statusGroup', params.statusGroup)
  if (params.q && String(params.q).trim()) sp.set('q', String(params.q).trim())
  if (params.dateFrom) sp.set('dateFrom', params.dateFrom)
  if (params.dateTo) sp.set('dateTo', params.dateTo)
  const sort = String(params.sort || 'created_desc')
  if (sort !== 'created_desc' && !sort.startsWith('status_')) sp.set('sort', sort)
  if (params.exempt && params.exempt !== 'all') sp.set('exempt', params.exempt)
  if (params.overdueOnly) sp.set('overdueOnly', '1')
  return sp.toString()
}

export function formatDateTimePt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatDatePt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { dateStyle: 'short' })
}

/** Rótulo PT para status MP + destaque operacional. */
export function paymentLogStatusLabel(status, isOverdue) {
  if (!status) return '—'
  const s = String(status).toLowerCase()
  if (s === 'approved' || s === 'authorized' || s === 'accredited') return 'Aprovado'
  if (s === 'pending') return isOverdue ? 'Vencido (pendente)' : 'Pendente'
  if (s === 'in_process') return isOverdue ? 'Vencido (em processamento)' : 'Em processamento'
  if (s === 'in_mediation') return 'Em mediação'
  if (s === 'rejected') return 'Recusado'
  if (s === 'cancelled') return 'Cancelado'
  if (s === 'refunded') return 'Estornado'
  if (s === 'charged_back') return 'Chargeback'
  return String(status)
}

const STATUS_SORT_ORDER = {
  approved: 10,
  authorized: 10,
  accredited: 10,
  pending: 20,
  in_process: 21,
  in_mediation: 22,
  rejected: 40,
  cancelled: 41,
  refunded: 50,
  charged_back: 51,
}

function statusOrder(st) {
  const s = String(st || '').toLowerCase()
  return STATUS_SORT_ORDER[s] ?? 35
}

/**
 * Ordenação local (status ou reforço quando API não cobre).
 * @param {any[]} rows
 * @param {'created_desc'|'created_asc'|'amount_desc'|'amount_asc'|'status_asc'|'status_desc'} sort
 */
export function sortPaymentLogRows(rows, sort) {
  const list = [...rows]
  if (sort === 'status_asc' || sort === 'status_desc') {
    const dir = sort === 'status_desc' ? -1 : 1
    list.sort((a, b) => {
      const cmp = statusOrder(a.status) - statusOrder(b.status)
      if (cmp !== 0) return cmp * dir
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return tb - ta
    })
    return list
  }
  return list
}

/**
 * Filtros apenas no cliente (sobre o lote já retornado pela API).
 * @param {any[]} rows
 * @param {{
 *   amountMin?: string
 *   amountMax?: string
 *   dueFrom?: string
 *   dueTo?: string
 *   payFrom?: string
 *   payTo?: string
 * }} f
 */
export function filterPaymentLogsClient(rows, f) {
  let out = rows
  const min = f.amountMin != null && String(f.amountMin).trim() !== '' ? Number(String(f.amountMin).replace(',', '.')) : null
  const max = f.amountMax != null && String(f.amountMax).trim() !== '' ? Number(String(f.amountMax).replace(',', '.')) : null
  if (min != null && Number.isFinite(min)) {
    out = out.filter((r) => (Number(r.amount) || 0) >= min)
  }
  if (max != null && Number.isFinite(max)) {
    out = out.filter((r) => (Number(r.amount) || 0) <= max)
  }

  const inRange = (iso, from, to) => {
    if (!from && !to) return true
    if (!iso) return false
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return false
    if (from) {
      const a = new Date(from.includes('T') ? from : `${from}T00:00:00`).getTime()
      if (t < a) return false
    }
    if (to) {
      const b = new Date(to.includes('T') ? to : `${to}T23:59:59`).getTime()
      if (t > b) return false
    }
    return true
  }

  out = out.filter((r) => inRange(r.dueDate || r.nextPaymentDate, f.dueFrom || '', f.dueTo || ''))
  out = out.filter((r) => inRange(r.lastPaymentDate, f.payFrom || '', f.payTo || ''))
  return out
}

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const CSV_COLS = [
  'created_at',
  'usuario_id',
  'userName',
  'userEmail',
  'amount',
  'status',
  'isExempt',
  'dueDate',
  'nextPaymentDate',
  'lastPaymentDate',
  'paymentMethod',
  'provider',
  'payment_id',
  'external_reference',
  'status_detail',
  'description',
  'preference_id',
]

function esc(v) {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportPaymentLogsCsv(rows) {
  const header = CSV_COLS.join(',')
  const lines = [header]
  for (const r of rows) {
    const cells = CSV_COLS.map((key) => {
      if (key === 'isExempt') return r.isExempt ? 'sim' : 'não'
      return esc(r[key])
    })
    lines.push(cells.join(','))
  }
  return lines.join('\n')
}

export function daysUntilLabel(iso) {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const d = Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000))
  if (d < 0) return `há ${Math.abs(d)} d`
  if (d === 0) return 'hoje'
  return `${d} d`
}

/** @param {any[]} rows @param {Record<string, any> | null} summary */
export function computeOperationalInsights(rows, summary) {
  const now = new Date()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(now)
  dayEnd.setHours(23, 59, 59, 999)
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  let dueToday = 0
  let due7 = 0
  let pendingAction = 0

  for (const r of rows) {
    const target = r.nextPaymentDate || r.dueDate
    if (!target) continue
    const d = new Date(target)
    if (Number.isNaN(d.getTime())) continue
    if (d >= dayStart && d <= dayEnd) dueToday += 1
    if (d >= now && d <= weekEnd) due7 += 1
  }

  for (const r of rows) {
    const st = String(r.status || '').toLowerCase()
    if (['pending', 'in_process', 'in_mediation'].includes(st) && (r.isOverdue || st === 'in_mediation')) {
      pendingAction += 1
    }
  }

  return {
    dueToday,
    due7,
    pendingAction,
    approvalRate: summary?.approvalRate ?? null,
    monthlyRevenue: summary?.monthlyRevenue ?? null,
    exemptCount: summary?.exemptCount ?? 0,
    overdueCount: summary?.overdueCount ?? 0,
    rejectedCount: summary?.rejectedCount ?? 0,
    summaryTruncated: summary?.summaryTruncated === true,
  }
}

export { formatCurrencyBRL }

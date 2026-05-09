import { apiUrl } from './apiUrl'

const TTL_MS = 55 * 60 * 1000

/** @type {{ at: number, data: object | null }} */
let mem = { at: 0, data: null }

/** @type {Promise<object> | null} */
let inflight = null

/**
 * CDI % a.a. (BCB SGS 4389). Partilha resultado entre montagens do componente.
 * @returns {Promise<object>}
 */
export function fetchTaxaCdiDeduplicated() {
  const now = Date.now()
  if (mem.data && now - mem.at < TTL_MS) {
    return Promise.resolve(mem.data)
  }
  if (inflight) return inflight

  inflight = (async () => {
    const res = await fetch(apiUrl('/api/taxa-cdi'), { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json.message || `CDI (${res.status})`)
    }
    mem = { at: Date.now(), data: json }
    return json
  })()
    .finally(() => {
      inflight = null
    })

  return inflight
}

export function formatCdiPercentPtBr(valorAa) {
  const n = Number(valorAa)
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
}

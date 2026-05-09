import { log } from '../lib/logger.mjs'

/** SGS 432 — Taxa Selic (% ao ano), último valor divulgado pelo BCB. */
const BCB_SELIC_URL =
  'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json'

const CACHE_TTL_MS = 60 * 60 * 1000

/** @type {{ ts: number, payload: object } | null} */
let cache = null

function parseBcbRow(body) {
  if (!Array.isArray(body) || body.length === 0) return null
  const row = body[0]
  if (!row || row.valor == null) return null
  const valor = Number.parseFloat(String(row.valor).replace(',', '.'))
  if (!Number.isFinite(valor)) return null
  return {
    valor_aa: valor,
    data_referencia: String(row.data || '').trim(),
    serie_sgs: 432,
    fonte: 'Banco Central do Brasil',
    descricao_curta: 'Taxa Selic (% a.a.)',
  }
}

export function registerTaxaSelicRoutes(app) {
  app.get('/api/taxa-selic', async (c) => {
    const now = Date.now()
    if (cache && now - cache.ts < CACHE_TTL_MS) {
      c.header('Cache-Control', 'public, max-age=3600')
      return c.json(cache.payload)
    }

    try {
      const res = await fetch(BCB_SELIC_URL, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`BCB respondeu ${res.status}.`)
      const json = await res.json()
      const payload = parseBcbRow(json)
      if (!payload) throw new Error('Formato da resposta do BCB inesperado.')

      cache = { ts: now, payload }
      c.header('Cache-Control', 'public, max-age=3600')
      return c.json(payload)
    } catch (err) {
      log.warn('taxa_selic_bcb', { err: String(err?.message || err) })
      if (cache?.payload) {
        c.header('Cache-Control', 'public, max-age=60')
        return c.json({ ...cache.payload, stale: true })
      }
      return c.json(
        { message: err?.message || 'Não foi possível obter a taxa Selic no momento.' },
        502,
      )
    }
  })
}

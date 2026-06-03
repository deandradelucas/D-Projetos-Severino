import { log } from '../lib/logger.mjs'
import { assertAgendaCronSecret } from '../lib/http/agenda-route-auth.mjs'
import { processDigestBatch } from '../lib/domain/digest-financeiro.mjs'
import { listarLimitesOrcamento } from '../lib/domain/alertas-financeiros.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'

export function registerDigestRoutes(app) {
  // GET /api/limites-orcamento — limites mensais por categoria (Orçado vs Real)
  app.get('/api/limites-orcamento', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const pessoal = c.req.query('pessoal')
      const dataId = pessoal === '1' ? parsed.actorId : parsed.dataUsuarioId
      const rows = await listarLimitesOrcamento(dataId)
      return c.json(Array.isArray(rows) ? rows : [])
    } catch (error) {
      log.error('listar limites orcamento', error)
      return c.json({ message: 'Erro ao listar limites de orçamento.' }, 500)
    }
  })

  app.get('/api/cron/digest-semanal', async (c) => {
    const auth = assertAgendaCronSecret(c)
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)

    try {
      const result = await processDigestBatch({ tipo: 'semanal' })
      log.info('[digest-cron] semanal processed', result)
      return c.json(result)
    } catch (error) {
      log.error('cron digest semanal', error)
      return c.json({ message: 'Erro no digest semanal.' }, 500)
    }
  })

  app.get('/api/cron/digest-mensal', async (c) => {
    const auth = assertAgendaCronSecret(c)
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)

    try {
      const result = await processDigestBatch({ tipo: 'mensal' })
      log.info('[digest-cron] mensal processed', result)
      return c.json(result)
    } catch (error) {
      log.error('cron digest mensal', error)
      return c.json({ message: 'Erro no digest mensal.' }, 500)
    }
  })
}

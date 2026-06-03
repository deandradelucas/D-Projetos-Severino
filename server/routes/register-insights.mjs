import { log } from '../lib/logger.mjs'
import { gerarInsights } from '../lib/insights.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

export function registerInsightsRoutes(app) {
  // GET /api/insights — insights proativos (regras determinísticas, sem IA)
  app.get('/api/insights', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const dataId = c.req.query('pessoal') === '1' ? parsed.actorId : parsed.dataUsuarioId
      const insights = await gerarInsights(dataId)
      return c.json(insights)
    } catch (error) {
      log.error('gerar insights', error)
      return c.json({ message: error.message || 'Erro ao gerar insights.' }, 500)
    }
  })
}

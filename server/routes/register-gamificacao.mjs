import { log } from '../lib/logger.mjs'
import { getEstadoGamificacao } from '../lib/gamificacao.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

/** Mesmo escopo das metas: pessoal=1 → próprio; senão titular da família. */
function resolveDataId(parsed, c) {
  return c.req.query('pessoal') === '1' ? parsed.actorId : parsed.dataUsuarioId
}

export function registerGamificacaoRoutes(app) {
  // GET /api/gamificacao — conquistas + streak (avalia, persiste e celebra novos)
  app.get('/api/gamificacao', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const estado = await getEstadoGamificacao(resolveDataId(parsed, c))
      return c.json(estado)
    } catch (error) {
      log.error('gamificacao', error)
      return c.json({ message: error.message || 'Erro ao carregar conquistas.' }, 500)
    }
  })
}

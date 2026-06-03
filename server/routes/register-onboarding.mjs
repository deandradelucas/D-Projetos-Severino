import { log } from '../lib/logger.mjs'
import { getOnboardingStatus } from '../lib/onboarding.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

export function registerOnboardingRoutes(app) {
  // GET /api/onboarding — estado do checklist de ativação
  app.get('/api/onboarding', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      // Onboarding é sempre pessoal (do próprio ator), não do escopo família.
      const status = await getOnboardingStatus(parsed.actorId)
      return c.json(status)
    } catch (error) {
      log.error('onboarding status', error)
      return c.json({ message: error.message || 'Erro ao carregar onboarding.' }, 500)
    }
  })
}

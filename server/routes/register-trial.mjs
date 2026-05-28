import { log } from '../lib/logger.mjs'
import { assertAgendaCronSecret } from '../lib/http/agenda-route-auth.mjs'
import { processarTrialNotificacoesCron } from '../lib/trial-notificacoes.mjs'

export function registerTrialRoutes(app) {
  app.get('/api/cron/trial-notificacoes', async (c) => {
    const auth = assertAgendaCronSecret(c)
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)

    try {
      const result = await processarTrialNotificacoesCron()
      log.info('[trial-cron] concluído', result)
      return c.json(result)
    } catch (error) {
      log.error('cron trial-notificacoes', error)
      return c.json({ message: 'Erro no cron de trial.' }, 500)
    }
  })
}

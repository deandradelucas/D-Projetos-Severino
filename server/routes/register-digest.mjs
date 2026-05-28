import { log } from '../lib/logger.mjs'
import { assertAgendaCronSecret } from '../lib/http/agenda-route-auth.mjs'
import { processDigestBatch } from '../lib/domain/digest-financeiro.mjs'

export function registerDigestRoutes(app) {
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

import { log } from '../lib/logger.mjs'
import { assertCronSecret } from '../lib/recorrencias-mensais.mjs'
import { processarRelatorioIACron, processarWatchdogIACron } from '../lib/relatorio-ia.mjs'

/** Crons de observabilidade de IA — agendados pelo n8n. */
export function registerIaCronRoutes(app) {
  // Semanal (segunda 08h BRT): relatório de correções de IA → Telegram
  app.get('/api/cron/relatorio-ia', async (c) => {
    const auth = assertCronSecret(c)
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)
    try {
      const result = await processarRelatorioIACron()
      log.info('[relatorio-ia-cron] concluído')
      return c.json(result)
    } catch (error) {
      log.error('cron relatorio-ia', error)
      return c.json({ message: 'Erro no relatório de IA.' }, 500)
    }
  })

  // A cada 30 min: watchdog de degradação (Gemini falhando / fallback Groq ativo)
  app.get('/api/cron/watchdog-ia', async (c) => {
    const auth = assertCronSecret(c)
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)
    try {
      const result = await processarWatchdogIACron()
      return c.json(result)
    } catch (error) {
      log.error('cron watchdog-ia', error)
      return c.json({ message: 'Erro no watchdog de IA.' }, 500)
    }
  })
}

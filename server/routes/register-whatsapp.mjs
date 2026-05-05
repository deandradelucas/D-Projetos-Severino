import { log } from '../lib/logger.mjs'
import { assertBotSecret } from '../lib/domain/whatsapp-bot.mjs'
import { processWhatsappBotBody, handleEvolutionWebhook } from '../lib/whatsapp/whatsapp-evolution-inbound.mjs'

export function registerWhatsappRoutes(app) {
  app.post('/api/whatsapp/bot/mensagem', async (c) => {
    const auth = assertBotSecret(c.req.header('Authorization'))
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)

    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ message: 'JSON inválido.' }, 400)
    }

    try {
      const result = await processWhatsappBotBody(body, { evolutionEnvFallback: true })
      return c.json(result.response, result.status)
    } catch (error) {
      log.error('[whatsapp-bot] processarMensagemBot failed', error)
      const raw = String(error?.message || '')
      if (/transcrev|Gemini|getBase64|baixar áudio|Áudio/i.test(raw)) {
        return c.json({ ok: false, reply: '🎙️ Não consegui transcrever o áudio. Tente novamente ou envie por texto.' }, 200)
      }
      return c.json({ ok: false, reply: '❌ Erro interno. Tente novamente.' }, 500)
    }
  })

  app.post('/api/whatsapp/webhook/:token', handleEvolutionWebhook)
  app.post('/api/whatsapp/webhook/:token/:event', handleEvolutionWebhook)
}

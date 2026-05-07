import { log } from '../lib/logger.mjs'
import { assertBotSecret } from '../lib/domain/whatsapp-bot.mjs'
import { processWhatsappBotBody, handleEvolutionWebhook } from '../lib/whatsapp/whatsapp-evolution-inbound.mjs'

/** Navegador usa GET; Evolution usa POST. Resposta só confirma URL + token. */
function evolutionWebhookGetProbe(c) {
  const expected = process.env.WHATSAPP_WEBHOOK_TOKEN
  const token = c.req.param('token') || c.req.query('token')
  if (!expected || token !== expected) {
    return c.json({ ok: false, message: 'Não autorizado.' }, 401)
  }
  return c.json({
    ok: true,
    message:
      'Webhook ativo. A Evolution envia POST com corpo JSON; abrir no browser (GET) não dispara o bot — só confirma domínio e token.',
  })
}

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

  app.get('/api/whatsapp/webhook/:token', evolutionWebhookGetProbe)
  app.get('/api/whatsapp/webhook/:token/:event', evolutionWebhookGetProbe)
  app.post('/api/whatsapp/webhook/:token', handleEvolutionWebhook)
  app.post('/api/whatsapp/webhook/:token/:event', handleEvolutionWebhook)
}

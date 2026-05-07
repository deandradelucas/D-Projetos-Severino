import { Hono } from 'hono'
import { isMercadoPagoConfigured } from '../lib/mercadopago.mjs'

const healthRoutes = new Hono()

healthRoutes.get('/health', (c) =>
  c.json({
    ok: true,
    t: new Date().toISOString(),
    mercadopago: { configured: isMercadoPagoConfigured() },
    gemini: { configured: Boolean(String(process.env.GEMINI_API_KEY || '').trim()) },
  })
)

export default healthRoutes

import { Hono } from 'hono'
import { isMercadoPagoConfigured } from '../lib/mercadopago.mjs'

const healthRoutes = new Hono()

healthRoutes.get('/health', (c) =>
  c.json({
    ok: true,
    t: new Date().toISOString(),
    mercadopago: { configured: isMercadoPagoConfigured() },
  })
)

export default healthRoutes

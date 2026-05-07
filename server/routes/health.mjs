import { Hono } from 'hono'
import { isAsaasConfigured } from '../lib/asaas.mjs'

const healthRoutes = new Hono()

healthRoutes.get('/health', (c) =>
  c.json({
    ok: true,
    t: new Date().toISOString(),
    asaas: { configured: isAsaasConfigured() },
    gemini: { configured: Boolean(String(process.env.GEMINI_API_KEY || '').trim()) },
  })
)

export default healthRoutes

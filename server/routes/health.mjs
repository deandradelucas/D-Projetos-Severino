import { Hono } from 'hono'
import { isAsaasConfigured } from '../lib/asaas.mjs'
import { aiTelemetrySnapshot } from '../lib/ai/ai-telemetry.mjs'

const healthRoutes = new Hono()

healthRoutes.get('/health', async (c) => {
  let ia = null
  try { ia = await aiTelemetrySnapshot() } catch { /* telemetria nunca derruba o health */ }
  return c.json({
    ok: true,
    t: new Date().toISOString(),
    asaas: { configured: isAsaasConfigured() },
    gemini: { configured: Boolean(String(process.env.GEMINI_API_KEY || '').trim()) },
    groq: { configured: Boolean(String(process.env.GROQ_API_KEY || '').trim()) },
    ia,
  })
})

export default healthRoutes

import { handleWhatsAppWebhook } from '../../server/lib/whatsapp.mjs'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  try {
    // Vercel raw req is a bit different from Hono req.
    // Wrap to match standard Web Request interface that handleWhatsAppWebhook expects.
    const standardReq = {
      headers: new Headers(req.headers),
      json: async () => typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    }

    const { status, json } = await handleWhatsAppWebhook(standardReq)
    return res.status(status).json(json)
  } catch (error) {
    console.error('Vercel Webhook Handler Error:', error)
    return res.status(500).json({ error: 'Internal Server Error.' })
  }
}

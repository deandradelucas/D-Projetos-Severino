import app from '../server/app.mjs'

export const runtime = 'nodejs'
export const maxDuration = 60

export default async function handler(req, res) {
  try {
    // Build full URL from Vercel request
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const url = `${protocol}://${host}${req.url}`

    // Collect body for non-GET/HEAD requests
    let body = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      if (chunks.length > 0) {
        body = Buffer.concat(chunks)
      }
    }

    // Convert Node headers to plain object
    const headers = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (value != null) {
        headers[key] = Array.isArray(value) ? value.join(', ') : String(value)
      }
    }

    // Create Web Standard Request and pass to Hono
    const request = new Request(url, {
      method: req.method,
      headers,
      body,
    })

    const response = await app.fetch(request)

    // Write Hono Response back to Vercel's res
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    const arrayBuffer = await response.arrayBuffer()
    res.end(Buffer.from(arrayBuffer))

  } catch (err) {
    console.error('[Catch-all] Error:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal Server Error', detail: err.message }))
  }
}

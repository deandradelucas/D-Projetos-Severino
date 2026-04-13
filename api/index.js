import { buffer as bufferStream } from 'node:stream/consumers'
import app from '../server/app.mjs'

export const runtime = 'nodejs'
export const maxDuration = 60

export default async function handler(req, res) {
  try {
    // Build full URL from Vercel request
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const url = `${protocol}://${host}${req.url}`

    /*
     * No Vercel, `for await (const chunk of req)` nem sempre consome o body corretamente.
     * Sem body, o Hono falha ao dar parse no JSON do POST → 500 no login.
     */
    let bodyBuf = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        bodyBuf = await bufferStream(req)
      } catch {
        bodyBuf = Buffer.alloc(0)
      }
    }

    // Convert Node headers to plain object
    const headers = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (value != null) {
        headers[key] = Array.isArray(value) ? value.join(', ') : String(value)
      }
    }

    const init = {
      method: req.method,
      headers,
    }
    if (bodyBuf && bodyBuf.length > 0) {
      init.body = bodyBuf
      if (!headers['content-type'] && !headers['Content-Type']) {
        init.headers = { ...headers, 'content-type': 'application/json' }
      }
    }

    const request = new Request(url, init)

    const response = await app.fetch(request)

    // Write Hono Response back to Vercel's res
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    const arrayBuffer = await response.arrayBuffer()
    res.end(Buffer.from(arrayBuffer))

  } catch (err) {
    console.error('[Catch-all] Error:', err)
    const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        message: 'Erro interno do servidor. Tente novamente em alguns instantes.',
        ...(isProd ? {} : { detail: err?.message ? String(err.message).slice(0, 500) : undefined }),
      }),
    )
  }
}

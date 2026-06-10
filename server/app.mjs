import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
import { compress } from 'hono/compress'
import { serveStatic } from '@hono/node-server/serve-static'
import { log } from './lib/logger.mjs'
import { Alerts } from './lib/notify-telegram.mjs'
import { createApp } from './app-factory.mjs'
import { httpRequestLogger, pagamentosRequestLogger } from './middleware/request-logger.mjs'
import { errorToText, mapSupabaseOrNetworkError } from './lib/http/hono-error-map.mjs'
import healthRoutes from './routes/health.mjs'
import { registerApiDomainRoutes } from './routes/register-all.mjs'

const app = createApp()

// Comprime todas as respostas (gzip/br). Registrado antes de tudo para envolver
// a chain inteira — security headers e Cache-Control são preservados pelo compress.
app.use('*', compress())

function corsAllowedOrigin(origin) {
  if (!origin) return null
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin
  /* IPs privados: somente em desenvolvimento local */
  if (process.env.NODE_ENV !== 'production') {
    if (
      /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin)
    ) {
      return origin
    }
  }
  /* Só https em produção: o Traefik redireciona http→https globalmente, então
   * nenhum browser legítimo chega aqui com Origin http. Exceção via CORS_ORIGINS. */
  if (/^https:\/\/([a-z0-9-]+\.)*mestredamente\.com$/i.test(origin)) return origin
  const extra = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (extra.includes(origin)) return origin
  return null
}

app.use(
  '*',
  cors({
    origin: (origin) => corsAllowedOrigin(origin),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  c.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ')
  )
})

app.use('*', httpRequestLogger)
app.use('/api/pagamentos/*', pagamentosRequestLogger)

app.route('/api', healthRoutes)

registerApiDomainRoutes(app)

// Assets com hash no nome (gerados pelo Vite) podem ser cacheados para sempre.
// O browser nunca re-baixa JS/CSS entre visitas enquanto o hash não mudar.
app.use('/assets/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'public, max-age=31536000, immutable')
})

app.use('*', serveStatic({ root: './dist' }))

// SPA fallback — sem cache para evitar UI desatualizada no browser
app.use('*', async (c) => {
  try {
    const html = await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf-8')
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return c.json({ message: 'Recurso não encontrado.' }, 404)
  }
})

app.notFound((c) => c.json({ message: 'Recurso não encontrado.' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  log.error('unhandled_route_error', {
    path: c.req.path,
    method: c.req.method,
    err: errorToText(err),
  })
  Alerts.serverError(c.req.path, err?.message)
  const mapped = mapSupabaseOrNetworkError(err)
  if (mapped) {
    return c.json({ message: mapped.message }, mapped.status)
  }
  return c.json(
    { message: 'Erro interno do servidor. Tente novamente em alguns instantes.' },
    500,
  )
})

export default app

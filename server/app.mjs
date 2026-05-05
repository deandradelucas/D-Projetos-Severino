import { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
import { log } from './lib/logger.mjs'
import { createApp } from './app-factory.mjs'
import { httpRequestLogger, pagamentosRequestLogger } from './middleware/request-logger.mjs'
import { errorToText, mapSupabaseOrNetworkError } from './lib/http/hono-error-map.mjs'
import healthRoutes from './routes/health.mjs'
import { registerApiDomainRoutes } from './routes/register-all.mjs'

const app = createApp()

function corsAllowedOrigin(origin) {
  if (!origin) return '*'
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin
  if (
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin)
  ) {
    return origin
  }
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
    allowHeaders: ['Content-Type', 'x-user-id', 'Authorization'],
  }),
)

app.use('*', httpRequestLogger)
app.use('/api/pagamentos/*', pagamentosRequestLogger)

app.route('/api', healthRoutes)

registerApiDomainRoutes(app)

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

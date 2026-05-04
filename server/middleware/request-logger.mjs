import { log } from '../lib/logger.mjs'
import { clientIpFromHono } from '../lib/http/client-ip.mjs'

export async function httpRequestLogger(c, next) {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  const status = c.res?.status || 200
  log.info('http_request', {
    method: c.req.method,
    path: c.req.path,
    status,
    duration_ms: duration,
    user_id: c.req.header('x-user-id') || null,
    client_ip: clientIpFromHono(c),
  })
}

export async function pagamentosRequestLogger(c, next) {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  log.info('pagamentos_request', {
    path: c.req.path,
    method: c.req.method,
    status: c.res?.status || 200,
    duration_ms: duration,
    user_id: c.req.header('x-user-id') || null,
  })
}

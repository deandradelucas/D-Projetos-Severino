import './lib/load-env.mjs'
import { serve } from '@hono/node-server'
import app from './app.mjs'
import { log } from './lib/logger.mjs'

const port = Number(process.env.API_PORT || 3001)

serve({
  fetch: app.fetch,
  port,
})

log.info(`API local pronta em http://localhost:${port}`)

import { serve } from '@hono/node-server'
import app from './app.mjs'

const port = Number(process.env.API_PORT || 3001)

serve({
  fetch: app.fetch,
  port,
})

console.log(`API local pronta em http://localhost:${port}`)

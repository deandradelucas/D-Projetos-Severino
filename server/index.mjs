import './lib/load-env.mjs'
import { serve } from '@hono/node-server'
import app from './app.mjs'
import { log } from './lib/logger.mjs'

const port = Number(process.env.API_PORT || 3001)
/** Sem hostname o Node pode escutar em :: (IPv6); o scripts/dev.mjs testa 127.0.0.1 e acharia a porta “livre” com EADDRINUSE só no IPv6. */
const hostname = process.env.API_HOST || '127.0.0.1'

const server = serve(
  {
    fetch: app.fetch,
    port,
    hostname,
  },
  (addr) => {
    const p = addr?.port ?? port
    log.info(`API local pronta em http://127.0.0.1:${p}`)
  },
)

server.on('error', (err) => {
  log.error('Falha ao abrir porta da API', err)
  process.exit(1)
})

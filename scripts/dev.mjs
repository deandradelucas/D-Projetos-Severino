/**
 * Inicia Vite + API local com a mesma API_PORT.
 * Se a porta preferida (API_PORT ou 3001) estiver ocupada, tenta a próxima até achar uma livre,
 * evitando EADDRINUSE e o proxy /api apontando para lugar nenhum.
 */
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function tryListenOnce(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve(false)
      else reject(err)
    })
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

async function allocateApiPort(preferred) {
  let p = preferred
  while (p < preferred + 40) {
    const ok = await tryListenOnce(p)
    if (ok) return p
    p += 1
  }
  throw new Error(`Nenhuma porta livre para a API entre ${preferred} e ${preferred + 39}.`)
}

const preferred = Number.parseInt(process.env.API_PORT || '3001', 10)
const apiPort = await allocateApiPort(preferred)

if (apiPort !== preferred) {
  process.stderr.write(
    `[dev] Porta ${preferred} ocupada; usando API em http://127.0.0.1:${apiPort} (proxy Vite alinhado).\n`,
  )
}

const env = { ...process.env, API_PORT: String(apiPort) }
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

const children = [
  spawn(process.execPath, [viteBin], { cwd: root, env, stdio: 'inherit' }),
  spawn(process.execPath, ['server/index.mjs'], { cwd: root, env, stdio: 'inherit' }),
]

let exiting = false

function shutdown(signal) {
  for (const c of children) {
    try {
      c.kill(signal)
    } catch {
      // ignore
    }
  }
}

process.on('SIGINT', () => {
  exiting = true
  shutdown('SIGINT')
  process.exit(130)
})
process.on('SIGTERM', () => {
  exiting = true
  shutdown('SIGTERM')
  process.exit(143)
})

for (const c of children) {
  c.on('exit', (code, signal) => {
    if (exiting) return
    exiting = true
    shutdown('SIGTERM')
    process.exit(code ?? (signal ? 1 : 0))
  })
}

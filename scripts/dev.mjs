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

function tryListenOnce(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => {
      resolve(false)
    })
    server.listen(port, host, () => {
      server.close(() => resolve(true))
    })
  })
}

async function allocatePort(preferred, host = '127.0.0.1', range = 40) {
  let p = preferred
  while (p < preferred + range) {
    const ok = await tryListenOnce(p, host)
    if (ok) return p
    p += 1
  }
  throw new Error(`Nenhuma porta livre entre ${preferred} e ${preferred + range - 1} em ${host}.`)
}

const preferredApi = Number.parseInt(process.env.API_PORT || '3001', 10)
const apiPort = await allocatePort(preferredApi)

if (apiPort !== preferredApi) {
  process.stderr.write(
    `[dev] Porta ${preferredApi} ocupada; usando API em http://127.0.0.1:${apiPort} (proxy Vite alinhado).\n`,
  )
} else {
  process.stderr.write(`[dev] Usando porta da API: ${apiPort}\n`)
}

const preferredVite = 3010
const vitePort = await allocatePort(preferredVite)
if (vitePort !== preferredVite) {
  process.stderr.write(
    `[dev] Porta ${preferredVite} ocupada; usando Vite em http://127.0.0.1:${vitePort}.\n`,
  )
} else {
  process.stderr.write(`[dev] Usando porta do Vite: ${vitePort}\n`)
}

const env = { ...process.env, API_PORT: String(apiPort), VITE_PORT: String(vitePort) }
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

const children = [
  spawn(process.execPath, [viteBin, '--port', String(vitePort)], { cwd: root, env, stdio: 'inherit' }),
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

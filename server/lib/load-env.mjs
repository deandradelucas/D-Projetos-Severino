/**
 * Carrega .env e depois .env.local (sobrescreve), alinhado ao Vite em dev.
 * Primeiro arquivo: não sobrescreve variáveis já definidas no ambiente.
 * .env.local: sobrescreve chaves presentes no arquivo (útil para segredos locais).
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())

function loadEnvFile(filePath, override) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (override || !(key in process.env)) {
      process.env[key] = value
    }
  }
}

/** Idempotente: reler os arquivos é barato e reforça env em scripts que só importam libs. */
export function loadEnv() {
  loadEnvFile(path.join(root, '.env'), false)
  loadEnvFile(path.join(root, '.env.local'), true)
}

loadEnv()

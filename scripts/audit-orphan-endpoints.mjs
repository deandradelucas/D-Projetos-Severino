#!/usr/bin/env node
/**
 * Lista endpoints definidos em `server/routes/*.mjs` (e arquivos vizinhos)
 * que não têm consumidor identificável no frontend (`src/`).
 *
 * Heurística: extrai o path literal de chamadas `app.get('/api/...')`,
 * `app.post(...)`, `app.put(...)`, `app.delete(...)`, `app.patch(...)`.
 * Para cada path, transforma `:param` em padrão regex e busca em arquivos
 * `.js/.jsx` de `src/` por strings que correspondam.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROUTE_DIRS = ['server/routes', 'server/app.mjs']
const FRONT_DIRS = ['src']
const EXTS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])

async function* walk(dir) {
  const stat = await fs.stat(dir).catch(() => null)
  if (!stat) return
  if (stat.isFile()) {
    if (EXTS.has(path.extname(dir))) yield dir
    return
  }
  const ents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const e of ents) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.') || e.name === 'segunda-feira') continue
      yield* walk(full)
    } else if (EXTS.has(path.extname(e.name))) {
      yield full
    }
  }
}

async function main() {
  const routes = []
  for (const d of ROUTE_DIRS) {
    const abs = path.join(ROOT, d)
    for await (const f of walk(abs)) {
      const text = await fs.readFile(f, 'utf8')
      const re = /\bapp\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
      let m
      while ((m = re.exec(text)) != null) {
        routes.push({ method: m[1].toUpperCase(), path: m[2], file: path.relative(ROOT, f).replace(/\\/g, '/') })
      }
    }
  }

  const frontTexts = []
  for (const d of FRONT_DIRS) {
    for await (const f of walk(path.join(ROOT, d))) {
      const text = await fs.readFile(f, 'utf8')
      frontTexts.push({ file: f, text })
    }
  }

  const orphans = []
  for (const r of routes) {
    // Constrói pattern: troca :param por [^/]+ e escapa o resto
    const pattern = r.path
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:[A-Za-z_][\w]*/g, '[^/]+')
    const re = new RegExp(pattern)
    let used = 0
    for (const { text } of frontTexts) {
      if (re.test(text)) {
        used++
        break
      }
    }
    if (!used) orphans.push(r)
  }

  console.log(`Total de rotas: ${routes.length}`)
  console.log(`Sem consumidor identificável no front (${orphans.length}):`)
  for (const o of orphans) {
    console.log(`  ${o.method.padEnd(6)} ${o.path}  (${o.file})`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

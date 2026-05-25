#!/usr/bin/env node
/**
 * Audita arquivos `.jsx`/`.js`/`.mjs` em diretórios alvo e reporta os
 * que não são importados por NENHUM outro arquivo do repo (lookup por
 * basename literal, com e sem extensão).
 *
 * Uso: node scripts/audit-orphan-files.mjs [--dir src/components]
 *
 * Heurística: um arquivo é candidato a órfão se nem o basename
 * (com extensão) nem o stem (sem extensão) aparecem em outros arquivos.
 * Falsos positivos possíveis (revisar manualmente):
 *  - Arquivos referenciados via string dinâmica (lazy import com `${...}`)
 *  - Arquivos que são entry points (main.jsx, server/index.mjs etc.)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_TARGETS = ['src/components', 'src/pages', 'server/lib', 'server/routes']
const SCAN_DIRS = ['src', 'server', 'api', 'scripts', 'docs']
const ENTRY_POINTS = new Set([
  'main.jsx', 'index.html', 'App.jsx',
  'index.mjs', 'app.mjs',
])
const EXTS_CODE = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])
const EXTS_SCAN = new Set([...EXTS_CODE, '.json', '.html', '.css', '.md'])

const arg = process.argv.slice(2)
const onlyArg = arg.find((a) => a.startsWith('--dir='))
const ONLY = onlyArg ? onlyArg.slice('--dir='.length) : null

async function* walk(dir, exts) {
  const ents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const e of ents) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.') || e.name === 'segunda-feira') continue
      yield* walk(full, exts)
    } else if (exts.has(path.extname(e.name))) {
      yield full
    }
  }
}

async function main() {
  const allText = []
  for (const d of SCAN_DIRS) {
    for await (const f of walk(path.join(ROOT, d), EXTS_SCAN)) {
      allText.push({ file: f, text: await fs.readFile(f, 'utf8').catch(() => '') })
    }
  }

  const targets = ONLY ? [ONLY] : DEFAULT_TARGETS
  const orphans = []
  for (const target of targets) {
    const targetAbs = path.join(ROOT, target)
    for await (const f of walk(targetAbs, EXTS_CODE)) {
      const base = path.basename(f)
      const stem = base.replace(path.extname(base), '')
      if (ENTRY_POINTS.has(base)) continue
      if (base.endsWith('.test.mjs') || base.endsWith('.test.js') || base.endsWith('.test.jsx')) continue
      let count = 0
      for (const { file, text } of allText) {
        if (file === f) continue
        if (text.includes(stem)) count++
      }
      if (count === 0) {
        orphans.push(path.relative(ROOT, f).replace(/\\/g, '/'))
      }
    }
  }

  if (orphans.length === 0) {
    console.log('Nenhum arquivo órfão detectado.')
    return
  }
  console.log(`Arquivos sem nenhum consumidor (${orphans.length}):`)
  for (const o of orphans) console.log(`  - ${o}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

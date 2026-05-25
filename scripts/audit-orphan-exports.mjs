#!/usr/bin/env node
/**
 * Audita exports nomeados em src/lib, src/components, server/lib e reporta
 * os que não são importados em lugar nenhum (lookup por nome literal).
 *
 * Uso: node scripts/audit-orphan-exports.mjs [--dir src/lib]
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGETS = ['src/lib', 'src/components', 'server/lib']
const SCAN_DIRS = ['src', 'server', 'api', 'scripts']
const EXTS_CODE = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])

const arg = process.argv.slice(2)
const onlyArg = arg.find((a) => a.startsWith('--dir='))
const ONLY = onlyArg ? onlyArg.slice('--dir='.length) : null

async function* walk(dir) {
  const ents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const e of ents) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue
      yield* walk(full)
    } else if (EXTS_CODE.has(path.extname(e.name))) {
      yield full
    }
  }
}

async function collectExports(file) {
  const txt = await fs.readFile(file, 'utf8')
  const exports = new Set()
  const re = /\bexport\s+(?:default\s+(?:function|class)\s+([A-Za-z_$][\w$]*)|(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)|let\s+([A-Za-z_$][\w$]*)|var\s+([A-Za-z_$][\w$]*))/g
  let m
  while ((m = re.exec(txt)) != null) {
    const name = m[1] || m[2] || m[3] || m[4] || m[5] || m[6]
    if (name && name !== 'default') exports.add(name)
  }
  // export { foo, bar }
  const reList = /\bexport\s*\{([^}]+)\}/g
  while ((m = reList.exec(txt)) != null) {
    for (const part of m[1].split(',')) {
      const piece = part.trim().split(/\s+as\s+/)
      const name = (piece[1] || piece[0] || '').trim()
      if (name && name !== 'default') exports.add(name)
    }
  }
  return exports
}

async function main() {
  const allFiles = []
  for (const d of SCAN_DIRS) {
    for await (const f of walk(path.join(ROOT, d))) allFiles.push(f)
  }

  const allText = await Promise.all(
    allFiles.map(async (f) => ({ file: f, text: await fs.readFile(f, 'utf8') })),
  )

  const targetDirs = ONLY ? [ONLY] : TARGETS
  const report = []
  for (const target of targetDirs) {
    const targetAbs = path.join(ROOT, target)
    for (const file of allFiles) {
      if (!file.startsWith(targetAbs)) continue
      if (file.endsWith('.test.mjs') || file.endsWith('.test.js') || file.endsWith('.test.jsx')) continue
      const exports = await collectExports(file)
      if (exports.size === 0) continue
      const orphans = []
      for (const name of exports) {
        const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'g')
        let count = 0
        for (const { file: f, text } of allText) {
          if (f === file) continue
          const matches = text.match(re)
          if (matches) count += matches.length
        }
        if (count === 0) orphans.push(name)
      }
      if (orphans.length > 0) {
        report.push({
          file: path.relative(ROOT, file).replace(/\\/g, '/'),
          totalExports: exports.size,
          orphans,
        })
      }
    }
  }

  if (report.length === 0) {
    console.log('Nenhum export órfão detectado.')
    return
  }
  for (const r of report) {
    console.log(`\n${r.file}  (${r.orphans.length}/${r.totalExports} órfãos):`)
    for (const o of r.orphans) console.log(`  - ${o}`)
  }
  console.log(`\nTotal: ${report.reduce((acc, r) => acc + r.orphans.length, 0)} exports órfãos em ${report.length} arquivos.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

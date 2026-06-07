#!/usr/bin/env node
/**
 * Orçamento de `!important` — "estancar o sangramento" (Auditoria CSS squad 2026-06).
 *
 * Mantém um baseline por arquivo (scripts/important-budget.json). Falha se QUALQUER
 * arquivo .css exceder seu baseline (= novo !important adicionado). Quando um arquivo
 * diminui, o baseline é apertado automaticamente com `--update` (catraca: só desce).
 *
 *   node scripts/check-important-budget.mjs            # CI/hook: falha se subiu
 *   node scripts/check-important-budget.mjs --update   # regrava baseline (após reduzir)
 *
 * Por que não stylelint: zero dependência nova, e a regra é "não pode subir" (não
 * "zero"), o que é o que importa enquanto a migração para @layer não acontece.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const BASELINE = path.join(ROOT, 'scripts', 'important-budget.json')
const UPDATE = process.argv.includes('--update')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.isFile() && e.name.endsWith('.css')) out.push(p)
  }
  return out
}

function countImportant(file) {
  const txt = fs.readFileSync(file, 'utf8')
  // Remove comentários para não contar !important comentado.
  const noComments = txt.replace(/\/\*[\s\S]*?\*\//g, '')
  return (noComments.match(/!important/g) || []).length
}

const counts = {}
let total = 0
for (const f of walk(SRC)) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  const n = countImportant(f)
  if (n > 0) {
    counts[rel] = n
    total += n
  }
}

if (UPDATE) {
  fs.writeFileSync(BASELINE, JSON.stringify({ total, files: counts }, null, 2) + '\n')
  console.log(`baseline atualizado: ${total} !important em ${Object.keys(counts).length} arquivos`)
  process.exit(0)
}

if (!fs.existsSync(BASELINE)) {
  console.error('Baseline ausente. Rode: node scripts/check-important-budget.mjs --update')
  process.exit(1)
}
const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).files || {}

const violations = []
for (const [rel, n] of Object.entries(counts)) {
  const allowed = base[rel] ?? 0
  if (n > allowed) violations.push(`${rel}: ${allowed} -> ${n} (+${n - allowed})`)
}

if (violations.length) {
  console.error('\n\x1b[31m✖ Orçamento de !important excedido (novos !important):\x1b[0m')
  for (const v of violations) console.error(`  \x1b[31m•\x1b[0m ${v}`)
  console.error(
    `\n\x1b[33mResolva o conflito com especificidade/ordem (ou @layer) em vez de !important.\n` +
      `Se for inevitável e justificado, rode \`node scripts/check-important-budget.mjs --update\` e explique no commit.\x1b[0m\n`,
  )
  process.exit(1)
}

const reduced = Object.entries(counts).filter(([rel, n]) => (base[rel] ?? 0) > n).length
console.log(`✓ !important dentro do orçamento (total ${total}; ${reduced} arquivo(s) abaixo do baseline — rode --update p/ apertar).`)
process.exit(0)

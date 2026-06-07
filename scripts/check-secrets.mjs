#!/usr/bin/env node
/**
 * Guard anti-segredo (pre-commit) — Auditoria squad 2026-06, C1.
 * Bloqueia commits que (a) adicionam arquivos `.env*` ou (b) contêm padrões de
 * chave/secret no conteúdo staged. Dependency-free: roda só `git` + node.
 *
 * Ativado via core.hooksPath=.githooks (configurado pelo script `prepare`).
 * Bypass consciente (raro): `git commit --no-verify`.
 */
import { execSync } from 'node:child_process'

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' })
}

const RED = '\x1b[31m'
const YEL = '\x1b[33m'
const RST = '\x1b[0m'

let staged = []
try {
  staged = sh('git diff --cached --name-only --diff-filter=ACM')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
} catch {
  process.exit(0) // sem git / sem staged → não bloqueia
}
if (!staged.length) process.exit(0)

const problems = []

// (a) arquivos .env* nunca devem ser commitados
for (const f of staged) {
  if (/(^|\/)\.env(\.|$)/.test(f)) {
    problems.push(`Arquivo de ambiente staged: ${f} — remova com \`git restore --staged ${f}\`.`)
  }
}

// (b) padrões de segredo no conteúdo staged
const PATTERNS = [
  { re: /\$aact_[A-Za-z0-9]/, label: 'Asaas API key ($aact_...)' },
  { re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, label: 'JWT/token longo (eyJ...)' },
  { re: /(api[_-]?key|secret|token|password|senha)\s*[:=]\s*['"][^'"\s]{16,}['"]/i, label: 'atribuição de credencial' },
  { re: /sk-[A-Za-z0-9]{20,}/, label: 'OpenAI-style key (sk-...)' },
]
const TEXT_EXT = /\.(mjs|js|jsx|ts|tsx|json|sql|env|yml|yaml|sh|md)$/i

for (const f of staged) {
  if (f === 'scripts/check-secrets.mjs') continue // este próprio arquivo
  if (!TEXT_EXT.test(f)) continue
  let diff = ''
  try {
    diff = sh(`git diff --cached -U0 -- "${f}"`)
  } catch {
    continue
  }
  for (const line of diff.split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    const body = line.slice(1)
    for (const { re, label } of PATTERNS) {
      if (re.test(body)) {
        problems.push(`${f}: possível ${label}`)
        break
      }
    }
  }
}

if (problems.length) {
  console.error(`\n${RED}✖ Commit bloqueado — possível vazamento de segredo:${RST}`)
  for (const p of [...new Set(problems)]) console.error(`  ${RED}•${RST} ${p}`)
  console.error(`\n${YEL}Se for falso positivo, revise e use \`git commit --no-verify\`.${RST}\n`)
  process.exit(1)
}
process.exit(0)

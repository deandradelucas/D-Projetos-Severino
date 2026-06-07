/**
 * Remove partes de seletor (lista por vírgula) que contêm uma classe MORTA como
 * token obrigatório de match (compound/descendente) — essas partes NUNCA casam,
 * pois a classe morta nunca está no DOM, então removê-las é zero-efeito.
 *
 * Conservador:
 *  - só considera classes mortas do detector find-unused-dashboard-css.mjs;
 *  - a classe morta precisa aparecer FORA de parênteses (ignora :not()/:is()/
 *    :where()/:has(), onde a classe morta NÃO bloqueia o match → não remover);
 *  - ignora conteúdo de [...] (atributos);
 *  - se todas as partes da regra forem removíveis, remove a regra inteira;
 *  - preserva a indentação da 1ª parte mantida.
 *
 * Uso: node scripts/strip-dead-compound.mjs [--write]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const PARTIALS = path.join(ROOT, 'src/pages/dashboard/partials')
const WRITE = process.argv.includes('--write')

const out = execSync('node scripts/find-unused-dashboard-css.mjs', { cwd: ROOT, encoding: 'utf8' })
const rawDead = out.split('\n').map((l) => l.trim()).filter((l) => /^[a-zA-Z_][\w-]*$/.test(l))

// Filtro anti-falso-positivo: classes construídas dinamicamente (ex.: `x--${v}`)
// não aparecem como literal, mas o PREFIXO BEM aparece no bundle JS → MANTER.
function srcBundle() {
  const acc = []
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(jsx|js)$/.test(e.name)) acc.push(fs.readFileSync(p, 'utf8')) } }
  walk(path.join(ROOT, 'src'))
  return acc.join('')
}
const BUNDLE = srcBundle()
function isDynamicPrefix(c) {
  const prefixes = new Set()
  if (c.includes('--')) prefixes.add(c.slice(0, c.lastIndexOf('--') + 2))
  prefixes.add(c.slice(0, c.lastIndexOf('-') + 1))
  for (const p of prefixes) if (p.length > 4 && BUNDLE.includes(p)) return true
  return false
}
const dead = new Set(rawDead.filter((c) => !isDynamicPrefix(c)))
console.log(`Mortas: ${rawDead.length} | dinâmicas filtradas: ${rawDead.length - dead.size} | genuínas: ${dead.size}\n`)
if (dead.size === 0) { console.log('Nenhuma classe genuinamente morta.'); process.exit(0) }

/** remove conteúdo de (...) e [...] de um seletor (para achar tokens "obrigatórios"). */
function stripParensBrackets(sel) {
  let r = ''
  let depthP = 0, depthB = 0
  for (const ch of sel) {
    if (ch === '(') { depthP++; continue }
    if (ch === ')') { depthP = Math.max(0, depthP - 1); continue }
    if (ch === '[') { depthB++; continue }
    if (ch === ']') { depthB = Math.max(0, depthB - 1); continue }
    if (depthP === 0 && depthB === 0) r += ch
  }
  return r
}

function classesOutsideParens(part) {
  const set = new Set()
  const re = /\.([a-zA-Z_][\w-]*)/g
  let m
  const clean = stripParensBrackets(part)
  while ((m = re.exec(clean)) !== null) set.add(m[1])
  return set
}

/** parte NUNCA casa? (contém classe morta como token obrigatório fora de parênteses) */
function partNeverMatches(part) {
  const p = part.trim()
  if (!p) return false
  for (const c of classesOutsideParens(p)) if (dead.has(c)) return true
  return false
}

function splitTopLevelCommas(sel) {
  const parts = []; let dp = 0, db = 0, cur = ''
  for (const ch of sel) {
    if (ch === '(') dp++; else if (ch === ')') dp--; else if (ch === '[') db++; else if (ch === ']') db--
    if (ch === ',' && dp === 0 && db === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  parts.push(cur); return parts
}

function parseNodes(css) {
  const nodes = []; let i = 0; const n = css.length
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++
    if (i >= n) break
    const start = i
    if (css[i] === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i + 2); i = e === -1 ? n : e + 2; nodes.push({ type: 'comment', start, end: i }); continue }
    let j = i
    while (j < n && css[j] !== '{' && css[j] !== ';') j++
    if (j >= n) { nodes.push({ type: 'text', start, end: n }); break }
    if (css[j] === ';') { i = j + 1; nodes.push({ type: 'statement', start, end: i }); continue }
    let depth = 0, k = j
    for (; k < n; k++) { if (css[k] === '{') depth++; else if (css[k] === '}') { depth--; if (depth === 0) { k++; break } } }
    nodes.push({ type: 'block', start, end: k, prelude: css.slice(start, j).trim(), bodyStart: j + 1, bodyInner: css.slice(j + 1, k - 1) })
    i = k
  }
  return nodes
}

const report = []
let removedRules = 0, trimmedParts = 0

function processFile(css, label) {
  const edits = [] // {start,end,replacement}
  function walk(text, offset) {
    for (const node of parseNodes(text)) {
      if (node.type !== 'block') continue
      const pre = node.prelude
      if (pre.startsWith('@')) {
        if (/^@(media|supports|layer|container)/i.test(pre)) walk(node.bodyInner, offset + node.bodyStart)
        continue
      }
      const parts = splitTopLevelCommas(pre)
      const deadIdx = parts.map((p, i) => (partNeverMatches(p) ? i : -1)).filter((i) => i >= 0)
      if (deadIdx.length === 0) continue
      if (deadIdx.length === parts.length) {
        // remove regra inteira
        edits.push({ start: offset + node.start, end: offset + node.end, replacement: '' })
        report.push(`${label}  RULE  ${pre.slice(0, 80)}`)
        removedRules++
      } else {
        const kept = parts.filter((_, i) => !deadIdx.includes(i)).map((s) => s.trim()).filter(Boolean)
        const indent = (parts[0].match(/^\s*/) || [''])[0]
        const newPre = kept.join(',\n' + indent)
        const rawPre = text.slice(node.start, node.bodyStart - 1)
        const trail = rawPre.endsWith(' ') ? ' ' : ''
        edits.push({ start: offset + node.start, end: offset + (node.bodyStart - 1), replacement: indent + newPre + trail })
        deadIdx.forEach((i) => { report.push(`${label}  part  ${parts[i].trim().slice(0, 80)}`); trimmedParts++ })
      }
    }
  }
  walk(css, 0)
  if (!edits.length) return css
  edits.sort((a, b) => b.start - a.start)
  let r = css
  for (const e of edits) {
    let s = e.start
    if (e.replacement === '') { while (s > 0 && /[ \t]/.test(r[s - 1])) s--; let en = e.end; while (en < r.length && r[en] === '\n') { en++; break }; r = r.slice(0, s) + r.slice(en) }
    else r = r.slice(0, e.start) + e.replacement + r.slice(e.end)
  }
  return r
}

const files = fs.readdirSync(PARTIALS).filter((f) => f.endsWith('.css'))
const changes = []
for (const f of files) {
  const fp = path.join(PARTIALS, f)
  const css = fs.readFileSync(fp, 'utf8')
  const next = processFile(css, f)
  if (next !== css) changes.push({ fp, next })
}
console.log(report.join('\n'))
console.log(`\nRegras removidas: ${removedRules} | partes aparadas: ${trimmedParts} | arquivos: ${changes.length}`)
if (WRITE) { for (const c of changes) fs.writeFileSync(c.fp, c.next); console.log('APLICADO.') }
else console.log('(dry-run)')

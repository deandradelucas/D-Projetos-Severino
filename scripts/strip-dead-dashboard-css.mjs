/**
 * Remove com segurança regras CSS cujos seletores miram EXCLUSIVAMENTE classes
 * mortas (não referenciadas em nenhum .jsx/.js de src, conforme
 * find-unused-dashboard-css.mjs). Mantém qualquer regra que toque uma classe
 * viva, id, :not() com classe viva, etc.
 *
 * Uso:
 *   node scripts/strip-dead-dashboard-css.mjs            # dry-run (só lista)
 *   node scripts/strip-dead-dashboard-css.mjs --write    # aplica
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const PARTIALS = path.join(ROOT, 'src/pages/dashboard/partials')
const WRITE = process.argv.includes('--write')

// 1) Lista de classes mortas via o detector existente
const out = execSync('node scripts/find-unused-dashboard-css.mjs', { cwd: ROOT, encoding: 'utf8' })
const dead = new Set(
  out.split('\n').map((l) => l.trim()).filter((l) => /^[a-zA-Z_][\w-]*$/.test(l))
)
if (dead.size === 0) { console.log('Nenhuma classe morta.'); process.exit(0) }

const classesInSelector = (sel) => {
  const set = new Set()
  const re = /\.([a-zA-Z_][\w-]*)/g
  let m
  while ((m = re.exec(sel)) !== null) set.add(m[1])
  return set
}

/** true se o seletor pode ser removido com segurança (mira só classes mortas). */
function selectorIsExclusivelyDead(selectorList) {
  // selectorList = "a, b, c" (pode ter vírgulas). TODAS as partes precisam ser
  // exclusivamente-mortas para remover a regra inteira.
  const parts = selectorList.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return false
  for (const part of parts) {
    if (part.includes('#')) return false // id → nunca
    const cls = classesInSelector(part)
    if (cls.size === 0) return false // sem classe (element/*/:root…) → manter
    for (const c of cls) if (!dead.has(c)) return false // toca classe viva → manter
  }
  return true
}

/** Tokeniza um CSS em nós de nível: style-rule ou at-rule (com corpo). */
function parseNodes(css) {
  const nodes = []
  let i = 0
  const n = css.length
  while (i < n) {
    // pula whitespace
    while (i < n && /\s/.test(css[i])) i++
    if (i >= n) break
    const start = i
    // comentário
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? n : end + 2
      nodes.push({ type: 'comment', start, end: i })
      continue
    }
    // lê prelúdio até { ou ;
    let j = i
    while (j < n && css[j] !== '{' && css[j] !== ';') j++
    if (j >= n) { nodes.push({ type: 'text', start, end: n }); break }
    if (css[j] === ';') { // at-rule sem corpo (ex.: @import, @layer x;)
      i = j + 1
      nodes.push({ type: 'statement', start, end: i, text: css.slice(start, i) })
      continue
    }
    // tem corpo { ... } — acha o fechamento balanceado
    let depth = 0, k = j
    for (; k < n; k++) {
      if (css[k] === '{') depth++
      else if (css[k] === '}') { depth--; if (depth === 0) { k++; break } }
    }
    const prelude = css.slice(start, j).trim()
    const bodyInner = css.slice(j + 1, k - 1)
    const node = { type: 'block', start, end: k, prelude, bodyStart: j + 1, bodyEnd: k - 1, bodyInner }
    nodes.push(node)
    i = k
  }
  return nodes
}

let totalRemoved = 0
const report = []

function processCss(css, fileLabel) {
  const nodes = parseNodes(css)
  const removals = [] // ranges [start,end] a remover do texto original
  for (const node of nodes) {
    if (node.type !== 'block') continue
    const pre = node.prelude
    if (pre.startsWith('@')) {
      // at-rule com corpo (media/supports/layer{}) — processa filhos
      const isContainer = /^@(media|supports|layer|container)/i.test(pre)
      if (!isContainer) continue
      const innerNodes = parseNodes(node.bodyInner)
      const innerStyleRules = innerNodes.filter((x) => x.type === 'block' && !x.prelude.startsWith('@'))
      if (innerStyleRules.length === 0) continue
      const innerRemovals = []
      for (const child of innerNodes) {
        if (child.type === 'block' && !child.prelude.startsWith('@') && selectorIsExclusivelyDead(child.prelude)) {
          innerRemovals.push([node.bodyStart + child.start, node.bodyStart + child.end])
          report.push(`${fileLabel} @media  ${child.prelude.slice(0, 70)}`)
          totalRemoved++
        }
      }
      // se removeria TODAS as style-rules e não há outras coisas relevantes, remove o @media inteiro
      const remainingStyle = innerStyleRules.length - innerRemovals.length
      const hasOtherMeaningful = innerNodes.some((x) => x.type === 'block' && x.prelude.startsWith('@'))
      if (remainingStyle === 0 && !hasOtherMeaningful) {
        removals.push([node.start, node.end])
        // ajusta contagem: já contabilizamos os filhos; o @media some junto
      } else {
        removals.push(...innerRemovals)
      }
    } else {
      // style-rule de topo
      if (selectorIsExclusivelyDead(pre)) {
        removals.push([node.start, node.end])
        report.push(`${fileLabel}        ${pre.slice(0, 70)}`)
        totalRemoved++
      }
    }
  }
  if (removals.length === 0) return css
  // aplica de trás pra frente
  removals.sort((a, b) => b[0] - a[0])
  let result = css
  for (const [s, e] of removals) {
    // engole whitespace/quebra à esquerda até o caractere anterior não-espaço
    let s2 = s
    while (s2 > 0 && /[ \t]/.test(result[s2 - 1])) s2--
    let e2 = e
    while (e2 < result.length && result[e2] === '\n') { e2++; break }
    result = result.slice(0, s2) + result.slice(e2)
  }
  return result
}

const files = fs.readdirSync(PARTIALS).filter((f) => f.endsWith('.css'))
const changes = []
for (const f of files) {
  const fp = path.join(PARTIALS, f)
  const css = fs.readFileSync(fp, 'utf8')
  const next = processCss(css, f)
  if (next !== css) changes.push({ fp, f, next })
}

console.log(report.join('\n'))
console.log(`\n${totalRemoved} regras exclusivamente-mortas em ${changes.length} arquivos.`)
if (WRITE) {
  for (const c of changes) fs.writeFileSync(c.fp, c.next)
  console.log('APLICADO.')
} else {
  console.log('(dry-run — rode com --write para aplicar)')
}

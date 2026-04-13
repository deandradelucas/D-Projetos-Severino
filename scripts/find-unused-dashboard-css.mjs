/**
 * Lista classes em dashboard.css sem referência em arquivos .jsx/.js em src/.
 * Uso: node scripts/find-unused-dashboard-css.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const CSS_FILE = path.join(ROOT, 'src/pages/dashboard.css')
const SRC = path.join(ROOT, 'src')

function walkJsx(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkJsx(p, acc)
    else if (/\.(jsx|js)$/.test(e.name)) acc.push(p)
  }
  return acc
}

function stripCssComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ')
}

/** Tokens usados em className (strings estáticas + partes simples de template). */
function collectClassTokens(source) {
  const tokens = new Set()
  const addChunk = (chunk) => {
    if (!chunk || chunk.includes('${')) return
    for (const w of chunk.trim().split(/\s+/)) {
      if (w && /^[\w-]+$/.test(w)) tokens.add(w)
    }
  }

  const reDq = /className\s*=\s*"([^"]*)"/g
  const reSq = /className\s*=\s*'([^']*)'/g
  const reTpl = /className\s*=\s*\{`([^`]*?)`\}/g
  let m
  while ((m = reDq.exec(source))) addChunk(m[1])
  while ((m = reSq.exec(source))) addChunk(m[1])
  while ((m = reTpl.exec(source))) addChunk(m[1])

  /* className={`foo ${x ? 'a' : 'b'}`} — captura trechos entre backticks */
  const reTplExpr = /className\s*=\s*\{`([\s\S]*?)`\}/g
  while ((m = reTplExpr.exec(source))) {
    const inner = m[1]
    for (const part of inner.split(/[?{}:]+/)) {
      const qs = part.match(/'([^']+)'|"([^"]+)"/g)
      if (qs) {
        for (const q of qs) {
          addChunk(q.slice(1, -1))
        }
      }
    }
  }

  return tokens
}

/** Classes injetadas por libs ou montadas por template (não aparecem como string literal). */
const SAFELIST = new Set([
  'recharts-legend-item-marker',
  'config-theme-preview--light',
  'config-theme-preview--dark',
  /* Transacoes.jsx: className={`badge badge-${status.toLowerCase()}`} */
  'badge-efetivada',
  'badge-pendente',
  /* PagamentoOrientacaoCard.jsx: pagamento-orientacao--${variant} */
  'pagamento-orientacao--success',
  'pagamento-orientacao--warning',
  'pagamento-orientacao--danger',
  'pagamento-orientacao--neutral',
  /* Legado: regras ainda presentes em dashboard.css / temas espelhados; UI atual usa dashboard-hub__* */
  'content-section',
  'section-header',
  'ref-dashboard-greeting',
  'ref-dashboard-greeting__name',
  'ref-dashboard-greeting__prefix',
  'ref-dashboard-header__actions',
  'ref-dashboard-header__lead',
  'ref-dashboard-header__btn-tx',
  'ref-dashboard-header__btn-wa',
  'ref-dashboard-header__btn-wa--disabled',
])

function referencedInSources(className, bundle, tokens) {
  if (SAFELIST.has(className)) return true
  if (tokens.has(className)) return true
  /* fronteira: não confundir substrings (ex.: "btn" em "btn-primary") */
  const re = new RegExp(
    `(?:^|[^a-zA-Z0-9_-])${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-zA-Z0-9_-])`
  )
  return re.test(bundle)
}

const cssRaw = fs.readFileSync(CSS_FILE, 'utf8')
const css = stripCssComments(cssRaw)

const files = walkJsx(SRC)
let bundle = ''
const tokenSet = new Set()
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  bundle += `\n${t}`
  for (const x of collectClassTokens(t)) tokenSet.add(x)
}

const classNames = new Set()
const re = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g
let mm
while ((mm = re.exec(css)) !== null) {
  classNames.add(mm[1])
}

const unused = []
const used = []
for (const c of [...classNames].sort()) {
  if (referencedInSources(c, bundle, tokenSet)) used.push(c)
  else unused.push(c)
}

console.log(`Total classes in CSS: ${classNames.size}`)
console.log(`Referenced in src: ${used.length}`)
console.log(`UNUSED (${unused.length}):`)
console.log(unused.join('\n'))

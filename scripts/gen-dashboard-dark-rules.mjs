/**
 * Gera src/pages/dashboard-theme-dark-mirror.css espelhando
 * body[data-theme='light'] / [data-theme='light'] com paleta escura (mesmo layout).
 *
 * Uso: node scripts/gen-dashboard-dark-rules.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const ROOT = path.resolve(import.meta.dirname, '..')
const CSS_FILE = path.join(ROOT, 'src/pages/dashboard.css')
const OUT_FILE = path.join(ROOT, 'src/pages/dashboard-theme-dark-mirror.css')
const DARK_POLISH_FILE = path.join(ROOT, 'src/pages/dashboard-theme-dark-polish.css')

const VALUE_REPLACEMENTS = [
  [/linear-gradient\(180deg,\s*#eef2f8\s+0%,\s*#e6eaf3\s+100%\)/g, 'linear-gradient(180deg, #141c26 0%, #101820 100%)'],
  [/linear-gradient\(180deg,\s*#f9fafc\s+0%,\s*#f3f5f9\s+100%\)/g, 'linear-gradient(180deg, #141a22 0%, #101820 100%)'],
  [/linear-gradient\(165deg,\s*#fdfeff\s+0%,\s*#f6f8fc\s+48%,\s*#eef2f8\s+100%\)/g, 'linear-gradient(165deg, #161d28 0%, #121a22 48%, #0e141c 100%)'],
  [/linear-gradient\(180deg,\s*#ffffff\s+0%,\s*#fcfcfd\s+100%\)/g, 'linear-gradient(180deg, #151c26 0%, #121820 100%)'],
  [/linear-gradient\(180deg,\s*#ffffff\s+0%,\s*#fafbfd\s+100%\)/g, 'linear-gradient(180deg, #1a222e 0%, #141b22 100%)'],
  [/radial-gradient\(ellipse\s+85%\s+55%\s+at\s+100%\s+-8%,\s*rgba\(59,\s*130,\s*246,\s*0\.055\),\s*transparent\s+48%\)/g, 'radial-gradient(ellipse 85% 55% at 100% -8%, rgba(96, 165, 250, 0.08), transparent 48%)'],
  [/radial-gradient\(ellipse\s+90%\s+50%\s+at\s+50%\s+-15%,\s*rgba\(59,\s*130,\s*246,\s*0\.06\),\s*transparent\s+52%\)/g, 'radial-gradient(ellipse 90% 50% at 50% -15%, rgba(96, 165, 250, 0.1), transparent 52%)'],
  [/radial-gradient\(ellipse\s+100%\s+70%\s+at\s+15%\s+-5%,\s*rgba\(255,\s*255,\s*255,\s*0\.42\),\s*transparent\s+52%\)/g, 'radial-gradient(ellipse 100% 70% at 15% -5%, rgba(255, 255, 255, 0.06), transparent 52%)'],
  [/rgba\(248,\s*250,\s*252,\s*0\.55\)/g, 'rgba(30, 41, 59, 0.45)'],
  [/rgba\(255,\s*255,\s*255,\s*0\.72\)/g, 'rgba(255, 255, 255, 0.06)'],
  [/rgba\(255,\s*255,\s*255,\s*0\.92\)/g, 'rgba(255, 255, 255, 0.06)'],
  [/rgba\(255,\s*255,\s*255,\s*0\.9\)\s+inset/g, 'rgba(255, 255, 255, 0.04) inset'],
  [/inset\s+0\s+1px\s+0\s+rgba\(255,\s*255,\s*255,\s*0\.92\)/g, 'inset 0 1px 0 rgba(255, 255, 255, 0.06)'],
  [/inset\s+0\s+1px\s+0\s+rgba\(255,\s*255,\s*255,\s*1\)/g, 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'],
  [/inset\s+-1px\s+0\s+0\s+rgba\(255,\s*255,\s*255,\s*0\.65\)/g, 'inset -1px 0 0 rgba(255, 255, 255, 0.04)'],
  [/rgba\(148,\s*163,\s*184,\s*0\.45\)/g, 'rgba(148, 163, 184, 0.35)'],
  [/rgba\(148,\s*163,\s*184,\s*0\.5\)/g, 'rgba(148, 163, 184, 0.4)'],
  [/rgba\(148,\s*163,\s*184,\s*0\.26\)/g, 'rgba(148, 163, 184, 0.22)'],
  [/rgba\(148,\s*163,\s*184,\s*0\.28\)/g, 'rgba(148, 163, 184, 0.25)'],
  [/rgba\(203,\s*213,\s*225,\s*0\.85\)/g, 'rgba(148, 163, 184, 0.35)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.22\)/g, 'rgba(0, 0, 0, 0.45)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.14\)/g, 'rgba(0, 0, 0, 0.35)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.1\)/g, 'rgba(0, 0, 0, 0.28)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.08\)/g, 'rgba(0, 0, 0, 0.22)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.06\)/g, 'rgba(0, 0, 0, 0.2)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.16\)/g, 'rgba(0, 0, 0, 0.4)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.32\)/g, 'rgba(0, 0, 0, 0.5)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.55\)/g, 'rgba(0, 0, 0, 0.55)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.18\)/g, 'rgba(0, 0, 0, 0.35)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.2\)/g, 'rgba(0, 0, 0, 0.38)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.12\)/g, 'rgba(0, 0, 0, 0.3)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.04\)/g, 'rgba(255, 255, 255, 0.04)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.07\)/g, 'rgba(255, 255, 255, 0.07)'],
  [/rgba\(15,\s*23,\s*42,\s*0\.05\)/g, 'rgba(255, 255, 255, 0.05)'],
  /* Superfícies claras (#f1f5f9) antes de inverter texto #0f172a→#f1f5f9, senão títulos/KPI ficam ilegíveis */
  [/#f1f5f9\b/g, '#1e293b'],
  [/#0f172a\b/g, '#f1f5f9'],
  [/#111827\b/g, '#f8fafc'],
  [/#1a1a1a\b/g, '#e2e8f0'],
  [/#334155\b/g, '#cbd5e1'],
  [/#475569\b/g, '#94a3b8'],
  [/#64748b\b/g, '#94a3b8'],
  [/#ffffff\b/g, '#1a222e'],
  [/#fafbfd\b/g, '#121820'],
  [/#f8fafc\b/g, '#111820'],
  [/#f4f6fa\b/g, '#0f1419'],
  [/#eef2f7\b/g, '#1a2332'],
  [/#e2e8f0\b/g, '#334155'],
  [/#e0e7ff\b/g, '#312e81'],
]

function transformValue(value) {
  let v = value
  for (const [re, rep] of VALUE_REPLACEMENTS) {
    v = v.replace(re, rep)
  }
  return v
}

function transformSelector(sel) {
  return sel
    .replace(/body\[data-theme='light'\]/g, "body[data-theme='dark']")
    .replace(/\[data-theme='light'\]/g, "[data-theme='dark']")
}

function cloneDeclsForDark(rule) {
  const out = rule.clone({})
  out.selectors = rule.selectors.map(transformSelector)
  out.walkDecls((decl) => {
    decl.value = transformValue(decl.value)
  })
  return out
}

function wrapWithAncestors(rule, node) {
  let n = node
  let p = rule.parent
  while (p && p.type !== 'root') {
    if (p.type === 'atrule') {
      const shell = p.clone({ nodes: [] })
      shell.append(n)
      n = shell
    }
    p = p.parent
  }
  return n
}

function shouldMirror(rule) {
  if (!rule.selectors?.length) return false
  const hit = rule.selectors.some(
    (s) => s.includes("body[data-theme='light']") || s.includes("[data-theme='light']")
  )
  if (!hit) return false
  if (rule.selectors.some((s) => s.includes("data-theme='dark']"))) return false
  const darkSels = rule.selectors.map(transformSelector)
  if (darkSels.join('||') === rule.selectors.join('||')) return false
  return true
}

const css = fs.readFileSync(CSS_FILE, 'utf8')
const ast = postcss.parse(css)
const outRoot = postcss.root()
outRoot.append(
  postcss.comment({
    text: ' AUTO-GENERADO por scripts/gen-dashboard-dark-rules.mjs — não editar. ',
  })
)

let n = 0
ast.walkRules((rule) => {
  if (!shouldMirror(rule)) return
  const darkRule = cloneDeclsForDark(rule)
  outRoot.append(wrapWithAncestors(rule, darkRule))
  n++
})

const banner = `/* eslint-disable max-lines -- gerado */\n`
const darkMirrorCss = banner + outRoot.toString()
fs.writeFileSync(OUT_FILE, darkMirrorCss, 'utf8')
console.error(`gen-dashboard-dark-rules: ${n} regras → ${path.relative(ROOT, OUT_FILE)}`)

if (!fs.existsSync(DARK_POLISH_FILE)) {
  console.error(`gen-dashboard-dark-rules: aviso — não encontrado ${path.relative(ROOT, DARK_POLISH_FILE)}`)
}

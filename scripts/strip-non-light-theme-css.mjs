/**
 * Remove regras cujo seletor referencia apenas temas escuro / cyberpunk / off-white.
 * Mantém seletores sem [data-theme=*], :root, e qualquer coisa com [data-theme='light'].
 *
 * Uso: node scripts/strip-non-light-theme-css.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const ROOT = path.resolve(import.meta.dirname, '..')
const CSS_FILE = path.join(ROOT, 'src/pages/dashboard.css')

const BAD_THEME = /\[data-theme='(dark|cyberpunk|off-white)'\]/
const LIGHT_THEME = /(\[data-theme='light'\]|body\[data-theme='light'\])/

function shouldKeepSelector(sel) {
  if (!BAD_THEME.test(sel)) return true
  if (LIGHT_THEME.test(sel)) return true
  return false
}

function cleanRule(rule) {
  if (!rule.selectors || rule.selectors.length === 0) return
  const next = rule.selectors.filter(shouldKeepSelector)
  if (next.length === 0) {
    rule.remove()
    return
  }
  if (next.length !== rule.selectors.length) {
    rule.selector = next.join(', ')
  }
}

const css = fs.readFileSync(CSS_FILE, 'utf8')
const root = postcss.parse(css)

root.walkRules((rule) => {
  cleanRule(rule)
})

let out = root.toString()

const isLong =
  /body:is\(\[data-theme='light'\], \[data-theme='dark'\], \[data-theme='cyberpunk'\], \[data-theme='off-white'\]\)/g
out = out.replace(isLong, "body[data-theme='light']")

fs.writeFileSync(CSS_FILE, out, 'utf8')

const before = css.length
const after = out.length
console.log(`strip-non-light-theme-css: ${CSS_FILE}`)
console.log(`  ${before} → ${after} bytes (${(((before - after) / before) * 100).toFixed(1)}% menor)`)

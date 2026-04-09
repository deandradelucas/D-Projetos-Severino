import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const p = path.join(__dirname, '../src/pages/dashboard.css')
let s = fs.readFileSync(p, 'utf8')
const re = /(\[data-theme='dark'\][^\n{}]*), (\[data-theme='cyberpunk'\][^\n{}]*)/g
let n = 0
s = s.replace(re, (full, a, b) => {
  const m = b.match(/^\[data-theme='cyberpunk'\](.*)$/)
  if (!m) return full
  const suffix = m[1]
  n += 1
  return `${a}, ${b}, [data-theme='off-white']${suffix}`
})
fs.writeFileSync(p, s)
console.log('patch-off-white-selectors:', n, 'lines')

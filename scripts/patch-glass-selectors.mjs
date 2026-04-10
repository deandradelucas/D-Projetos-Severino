import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const p = path.join(__dirname, '..', 'src', 'pages', 'dashboard.css')
let lines = fs.readFileSync(p, 'utf8').split('\n')
lines = lines.map((line) => {
  if (
    !line.includes("[data-theme='dark']") ||
    !line.includes("[data-theme='off-white']") ||
    !line.includes("[data-theme='cyberpunk']")
  ) {
    return line
  }
  const m = line.match(/^(\s*)(.+), \[data-theme='off-white'\] (.+?) \{\s*$/)
  if (!m) return line
  const indent = m[1]
  const prefix = m[2]
  const rest = m[3]
  return `${indent}${prefix}, [data-theme='off-white'] ${rest}, [data-theme='glass'] ${rest} {`
})
fs.writeFileSync(p, lines.join('\n'))
console.log('patched', p)

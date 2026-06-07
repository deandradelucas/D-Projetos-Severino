/**
 * Remove `!important` de um partial CSS, PRESERVANDO os blocos cujo seletor
 * contém alguma das classes "load-bearing" (que de fato dependem do !important
 * para vencer a base). Comment-safe e ciente de @media/@supports/@layer.
 *
 * As classes load-bearing são descobertas empiricamente: strip total na página +
 * fingerprint (Playwright) → elementos que mudam → suas classes entram no KEEP.
 * O resultado DEVE ser verificado com fingerprint `diff=0` (claro+escuro) antes de commit.
 *
 * Uso:
 *   node scripts/strip-important-keep.mjs <arquivo.css> <keep,csv> [--only=<regex>]
 *
 * KEEP (csv):
 *   - token simples         → match por substring no prelúdio do bloco
 *   - token "re:<padrão>"   → match por regex no prelúdio do bloco
 *
 * --only=<regex> (opcional):
 *   Limita o strip aos blocos cujo prelúdio CASA o regex. Blocos fora do escopo
 *   ficam 100% intactos. Útil para isolar uma seção (ex.: --only=agenda) num
 *   arquivo heterogêneo cujos seletores compartilham tokens de container.
 */
import fs from 'node:fs'

const argv = process.argv.slice(2)
const positional = argv.filter((a) => !a.startsWith('--'))
const flags = Object.fromEntries(
  argv.filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.join('=')]
  }),
)
const [file, keepCsv] = positional
if (!file || !keepCsv) {
  console.error('uso: node scripts/strip-important-keep.mjs <arquivo.css> <keep,csv> [--only=<regex>]')
  process.exit(1)
}

const KEEP = keepCsv.split(',').map((s) => s.trim()).filter(Boolean).map((t) =>
  t.startsWith('re:') ? { re: new RegExp(t.slice(3)) } : { sub: t },
)
const ONLY = flags.only ? new RegExp(flags.only) : null

function keepBlock(prelude) {
  // Fora do escopo --only → preservar intacto
  if (ONLY && !ONLY.test(prelude)) return true
  // Load-bearing (substring ou regex) → preservar
  return KEEP.some((k) => (k.re ? k.re.test(prelude) : prelude.includes(k.sub)))
}

function strip(text) {
  let out = '', i = 0
  const n = text.length
  while (i < n) {
    if (text[i] === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); const end = e === -1 ? n : e + 2; out += text.slice(i, end); i = end; continue }
    let j = i
    while (j < n) { if (text[j] === '/' && text[j + 1] === '*') { const e = text.indexOf('*/', j + 2); j = e === -1 ? n : e + 2; continue } if (text[j] === '{' || text[j] === '}' || text[j] === ';') break; j++ }
    if (j >= n) { out += text.slice(i); break }
    if (text[j] === ';' || text[j] === '}') { out += text.slice(i, j + 1); i = j + 1; continue }
    let d = 0, k = j
    for (; k < n; k++) { if (text[k] === '/' && text[k + 1] === '*') { const e = text.indexOf('*/', k + 2); k = e === -1 ? n : e + 1; continue } if (text[k] === '{') d++; else if (text[k] === '}') { d--; if (d === 0) { k++; break } } }
    const prelude = text.slice(i, j), body = text.slice(j, k)
    if (/@(media|supports|layer|container)/.test(prelude)) out += prelude + '{' + strip(body.slice(1, -1)) + '}'
    else out += prelude + (keepBlock(prelude) ? body : body.replace(/ !important/g, ''))
    i = k
  }
  return out
}

const before = (fs.readFileSync(file, 'utf8').match(/!important/g) || []).length
fs.writeFileSync(file, strip(fs.readFileSync(file, 'utf8')))
const after = (fs.readFileSync(file, 'utf8').match(/!important/g) || []).length
console.log(`${file}: !important ${before} -> ${after}` + (ONLY ? ` [--only=${flags.only}]` : '') + ` (KEEP: ${keepCsv})`)

#!/usr/bin/env node
/**
 * Inventaria os arquivos em `public/` que parecem nao ser referenciados
 * em lugar nenhum (src/, server/, scripts/, index.html, public/manifest.json,
 * public/sw.js, public/*.html).
 *
 * Heuristica: para cada arquivo em public/, busca o basename
 * e o caminho relativo nos arquivos de codigo. Se nao encontrar, marca
 * como suspeito de ser orfao.
 *
 * Atencao: e uma heuristica. Antes de remover, conferir manualmente.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = path.join(ROOT, 'public')
const SEARCH_DIRS = ['src', 'server', 'scripts', 'docs', 'index.html', 'vite.config.js']
const SEARCH_FILES_IN_PUBLIC = ['manifest.json', 'sw.js', 'login.html', 'cadastro.html']
const TEXT_EXTS = new Set([
  '.js', '.jsx', '.mjs', '.ts', '.tsx',
  '.css', '.html', '.json', '.md', '.sql',
])

/* Sao "entry points" — sempre considerados usados, mesmo sem importer textual. */
const ALWAYS_USED = new Set([
  'manifest.json',
  'sw.js',
  '.htaccess',
  'login.html',
  'cadastro.html',
])

/**
 * Diretorios consumidos por mapeamento dinamico (template literal com chave),
 * em que cada arquivo so aparece via `${key}.png` no codigo. Aceito que tudo
 * dentro deles e usado se a chave (basename sem extensao) aparecer entre aspas
 * em algum arquivo + o path do diretorio aparecer noutro/mesmo arquivo.
 *
 * Se um arquivo nao aparece nem como key nem por nome literal, ainda cai como
 * orfao mesmo dentro de um diretorio dinamico — assim arquivos esquecidos sao
 * pegos.
 */
const DYNAMIC_DIRS = [
  'banks/',
]

async function* walk(dir) {
  const stat = await fs.stat(dir).catch(() => null)
  if (!stat) return
  if (stat.isFile()) {
    yield dir
    return
  }
  const ents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const e of ents) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.') || e.name === 'segunda-feira') continue
      yield* walk(full)
    } else {
      yield full
    }
  }
}

async function listPublicFiles() {
  const out = []
  for await (const f of walk(PUBLIC_DIR)) {
    out.push(f)
  }
  return out
}

async function loadHaystack() {
  const texts = []
  for (const dir of SEARCH_DIRS) {
    const abs = path.join(ROOT, dir)
    for await (const f of walk(abs)) {
      if (!TEXT_EXTS.has(path.extname(f).toLowerCase())) continue
      const text = await fs.readFile(f, 'utf8').catch(() => '')
      if (text) texts.push({ file: f, text })
    }
  }
  for (const name of SEARCH_FILES_IN_PUBLIC) {
    const abs = path.join(PUBLIC_DIR, name)
    const text = await fs.readFile(abs, 'utf8').catch(() => '')
    if (text) texts.push({ file: abs, text })
  }
  return texts
}

function isReferenced(asset, haystack) {
  const rel = path.relative(PUBLIC_DIR, asset).replace(/\\/g, '/')
  const base = path.basename(asset)
  const baseNoExt = base.replace(/\.[^.]+$/, '')

  if (ALWAYS_USED.has(rel) || ALWAYS_USED.has(base)) return 'always-used'

  /* 1) Match literal: caminho relativo ou basename completo aparecem no codigo. */
  const candidates = [base, rel, '/' + rel]
  for (const { text } of haystack) {
    for (const c of candidates) {
      if (text.includes(c)) return true
    }
  }

  /* 2) Match dinamico restrito a pastas declaradas (DYNAMIC_DIRS): pede
   *    `'<key>'` ou `"<key>"` (chave isolada entre aspas) E presenca do
   *    path do diretorio em algum arquivo. */
  const inDynamicDir = DYNAMIC_DIRS.some((d) => rel.startsWith(d))
  if (inDynamicDir) {
    const dirPattern = '/' + path.dirname(rel) + '/'
    let dirSeen = false
    let keySeen = false
    for (const { text } of haystack) {
      if (!dirSeen && text.includes(dirPattern)) dirSeen = true
      if (!keySeen && (text.includes(`'${baseNoExt}'`) || text.includes(`"${baseNoExt}"`))) {
        keySeen = true
      }
      if (dirSeen && keySeen) return 'dynamic-map'
    }
  }

  return false
}

async function main() {
  const files = await listPublicFiles()
  const haystack = await loadHaystack()

  const orphans = []
  for (const f of files) {
    const ref = isReferenced(f, haystack)
    if (!ref) orphans.push(f)
  }

  console.log(`Total de arquivos em public/: ${files.length}`)
  console.log(`Sem referencia identificavel (${orphans.length}):`)
  for (const o of orphans) {
    console.log('  ' + path.relative(ROOT, o).replace(/\\/g, '/'))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

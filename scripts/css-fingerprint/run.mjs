#!/usr/bin/env node
/**
 * CSS Fingerprint Runner — automatiza as CENAS do harness (passo 1 / C1 da
 * migração @layer). Usa o módulo validado capture.browser.js, injetado via
 * addInitScript (sobrevive a navegação — resolve o problema de re-inject).
 *
 * Pré-requisito (não instalado por padrão — é pesado):
 *   npm i -D playwright && npx playwright install chromium
 *
 * Credenciais via env (NUNCA hardcode — o guard de segredos bloqueia):
 *   CSSFP_EMAIL=...  CSSFP_PASS=...  [CSSFP_BASE=http://localhost:3010]
 *
 * Uso:
 *   node scripts/css-fingerprint/run.mjs --baseline   # captura baseline → fingerprint-baseline.json
 *   node scripts/css-fingerprint/run.mjs --check       # diff vs baseline; exit 1 se diff>0
 *
 * Cada cena roda selfTest (exige ok:true) antes de confiar em diff=0.
 * Cenas validadas ao vivo (2026-06-07): estáticas, pseudo-elementos, modal aberto,
 * erro de formulário (:invalid). Demais (hover/focus/print/reduced-motion) usam
 * primitivas padrão do Playwright sobre o mesmo núcleo.
 */
/* global window, document -- trechos dentro de page.evaluate/addInitScript rodam no browser */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BASELINE_FILE = path.join(HERE, 'fingerprint-baseline.json')
const CAPTURE_SRC = fs.readFileSync(path.join(HERE, 'capture.browser.js'), 'utf8')

const BASE = process.env.CSSFP_BASE || 'http://localhost:3010'
const EMAIL = process.env.CSSFP_EMAIL
const PASS = process.env.CSSFP_PASS
const MODE = process.argv.includes('--check') ? 'check' : process.argv.includes('--baseline') ? 'baseline' : null
// --only <substr>: no modo check, captura/compara apenas cenas cujo key contém <substr>
// (loop por-unidade rápido, ex.: --only /cartoes). Ignorado em baseline (sempre full).
const onlyIdx = process.argv.indexOf('--only')
const ONLY = MODE === 'check' && onlyIdx > -1 ? process.argv[onlyIdx + 1] : null
const want = (key) => !ONLY || key.includes(ONLY)

if (!MODE) { console.error('uso: --baseline | --check [--only <substr>]'); process.exit(1) }
if (!EMAIL || !PASS) { console.error('defina CSSFP_EMAIL e CSSFP_PASS no ambiente'); process.exit(1) }

// --- Definição das CENAS ---------------------------------------------------
// state(page): monta o estado e retorna o rootSel a capturar (ou null p/ pular).
const PAGE_ROOTS = {
  '/dashboard': '.app-layout-shell',
  '/transacoes': '.page-transacoes',
  '/relatorios': '.page-relatorios',
  '/investimentos': '.page-investimentos',
  '/agenda': '.agenda-page',
  '/configuracoes': '.page-configuracoes',
  '/lista-de-compras': '.page-lista-compras',
  '/pagamento': '.page-pagamento',
  '/metas': '.page-metas',
  '/cartoes': '.page-cartoes',
}
const VIEWPORTS = [{ name: 'desktop', w: 1440, h: 900 }, { name: 'mobile', w: 390, h: 844 }]
const THEMES = ['light', 'dark']

// Cenas de estado (modal/erro) — gatilho + root. Validadas ao vivo.
const STATE_SCENES = [
  {
    id: 'modal-nova-tx', route: '/transacoes', root: '.modal-content--nova-tx',
    async open(page) { await clickByText(page, 'button', /nova transa/i) },
  },
  {
    id: 'erro-nova-tx', route: '/transacoes', root: '.modal-content--nova-tx',
    async open(page) {
      await clickByText(page, 'button', /nova transa/i)
      await clickByText(page, '.modal-content--nova-tx button, .modal-actions button', /salvar|adicionar|criar|confirmar/i)
    },
  },
  {
    id: 'modal-comparador', route: '/investimentos', root: '.page-investimentos-comparador',
    async open(page) { await clickByText(page, 'button', /comparar/i) },
  },
  {
    id: 'modal-lista', route: '/lista-de-compras', root: '.page-lista-compras__modal-overlay',
    async open(page) { await clickByText(page, 'button', /nova lista/i) },
  },
]
// Hover/focus em elementos-chave (Playwright força o estado real).
const HOVER_TARGETS = [
  { route: '/dashboard', root: '.app-layout-shell', sel: '.nav-item' },
  { route: '/transacoes', root: '.page-transacoes', sel: '.ref-tx-row' },
]
// Mídias emuladas.
const MEDIA = [{ id: 'print', media: 'print' }, { id: 'reduced-motion', reducedMotion: 'reduce' }]

async function clickByText(page, sel, re) {
  const handle = await page.evaluateHandle(
    ([s, src]) => {
      const rx = new RegExp(src.slice(1, src.lastIndexOf('/')), src.slice(src.lastIndexOf('/') + 1))
      const el = [...document.querySelectorAll(s)].find((b) => rx.test((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')))
      if (el) el.click()
      return !!el
    },
    [sel, re.toString()],
  )
  await handle.dispose()
  await page.waitForTimeout(350)
}

async function login(page) {
  // Login via API (mesmo endpoint do app) — robusto ao fluxo multi-step da UI
  // (AuthPhoneShell + webauthn). Persiste refresh token + user; o bootstrap do
  // app reobtém o access token na próxima navegação.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  const res = await page.evaluate(async ([base, email, pass]) => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password: pass }),
    })
    const raw = await r.text(); let d = {}; try { d = JSON.parse(raw) } catch { /* */ }
    if (r.ok && d.refreshToken) {
      localStorage.setItem('horizonte_refresh_token', d.refreshToken)
      if (d.user?.id) localStorage.setItem('horizonte_user', JSON.stringify(d.user))
    }
    return { ok: r.ok, hasRefresh: !!d.refreshToken, msg: d.message || raw.slice(0, 120) }
  }, [BASE, EMAIL, PASS])
  if (!res.ok || !res.hasRefresh) throw new Error(`login API falhou: ${res.msg}`)
  await page.waitForTimeout(800)
}

// Aguarda a página montar de verdade: root presente + rede ociosa + settle.
// Substitui o sleep fixo (900ms era insuficiente para páginas data-heavy —
// causava root ausente → selfTest falho).
async function settle(page, root) {
  if (root) await page.waitForSelector(root, { state: 'attached', timeout: 15000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
  // Espera o DOM PARAR de mudar: conteúdo async (ex.: delta de saldo do dashboard
  // com placeholder/shimmer) altera a contagem de elementos conforme carrega.
  // Capturar antes disso = contagem variável → falso diff. Poll até 2 leituras
  // consecutivas terem a mesma contagem de descendentes do root.
  if (root) {
    await page.waitForFunction((r) => {
      const el = document.querySelector(r)
      if (!el) return false
      const n = el.querySelectorAll('*').length
      if (window.__cssfp_lastN === n) return true
      window.__cssfp_lastN = n
      return false
    }, root, { timeout: 8000, polling: 450 }).catch(() => {})
  }
  await page.waitForTimeout(500)
}

// Navega e garante a raiz. Sob carga do dev server, a 1ª navegação às vezes não
// monta a raiz a tempo — recarrega 1x antes de desistir (mata a flakiness).
async function gotoSettled(page, route, root) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
    await settle(page, root)
    if (!root) return true
    const found = await page.$(root)
    if (found) return true
  }
  return false
}

async function capture(page, root, theme) {
  return page.evaluate(([r, t]) => {
    const st = window.__cssfp.selfTest(r, t)
    if (!st.ok) return { error: 'selfTest falhou (harness não detecta quebra)', st }
    const rows = window.__cssfp.capRaw(r, t)
    return { rows }
  }, [root, theme])
}

async function run() {
  let chromium
  try { ({ chromium } = await import('playwright')) }
  catch { console.error('playwright não instalado. Rode: npm i -D playwright && npx playwright install chromium'); process.exit(1) }

  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  await ctx.addInitScript(CAPTURE_SRC) // injeta __cssfp em TODA navegação
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)

  const scenes = {}
  const closeChat = () => page.evaluate(() => document.querySelector('.horizon-chat-close')?.click()).catch(() => {})

  // Cenas 1+2: rotas estáticas × viewport × tema (pseudo automático)
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    for (const [route, root] of Object.entries(PAGE_ROOTS)) {
      if (!want(`static|${route}`)) continue
      await gotoSettled(page, route, root); await closeChat()
      for (const theme of THEMES) {
        const key = `static|${route}|${vp.name}|${theme}`
        const res = await capture(page, root, theme)
        scenes[key] = res.error ? res : res.rows
      }
    }
  }
  // Cena 3+6: estados (modal/erro) — desktop+mobile
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    for (const sc of STATE_SCENES) {
      if (!want(`state|${sc.id}`)) continue
      await gotoSettled(page, sc.route, PAGE_ROOTS[sc.route]); await closeChat()
      try { await sc.open(page); await page.waitForSelector(sc.root, { timeout: 6000 }).catch(() => {}) } catch { /* gatilho ausente nesse vp */ }
      for (const theme of THEMES) {
        const key = `state|${sc.id}|${vp.name}|${theme}`
        const res = await capture(page, sc.root, theme)
        scenes[key] = res.error ? res : res.rows
      }
    }
  }
  // Cena 4: hover
  for (const h of HOVER_TARGETS) {
    if (!want(`hover|${h.route}`)) continue
    await gotoSettled(page, h.route, h.root); await closeChat()
    try { await page.hover(h.sel, { timeout: 2000 }) } catch { /* ausente */ }
    for (const theme of THEMES) {
      const res = await capture(page, h.root, theme)
      scenes[`hover|${h.route}|${theme}`] = res.error ? res : res.rows
    }
  }
  // Cena 7+8: mídia emulada (dashboard)
  for (const m of MEDIA) {
    if (!want(`media|${m.id}`)) continue
    await page.emulateMedia(m.media ? { media: m.media } : { reducedMotion: m.reducedMotion })
    await gotoSettled(page, '/dashboard', '.app-layout-shell'); await closeChat()
    const res = await capture(page, '.app-layout-shell', 'light')
    scenes[`media|${m.id}`] = res.error ? res : res.rows
  }
  await page.emulateMedia({ media: 'screen', reducedMotion: 'no-preference' })

  await browser.close()
  return scenes
}

const scenes = await run()
const sceneKeys = Object.keys(scenes)
const errored = sceneKeys.filter((k) => scenes[k] && scenes[k].error)

if (MODE === 'baseline') {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(scenes))
  console.log(`baseline: ${sceneKeys.length} cenas salvas em ${path.basename(BASELINE_FILE)}`)
  if (errored.length) console.warn(`⚠ ${errored.length} cena(s) com selfTest falho: ${errored.join(', ')}`)
  process.exit(0)
}

// --check
if (!fs.existsSync(BASELINE_FILE)) { console.error('baseline ausente — rode --baseline primeiro'); process.exit(1) }
const base = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
function diff(curr, b) {
  if (!curr || !b || curr.error || b.error) return -1
  let d = 0; const n = Math.min(curr.length, b.length)
  for (let i = 0; i < n; i++) if (curr[i].v !== b[i].v) d++
  return d + Math.abs(curr.length - b.length)
}
// Compara apenas as cenas CAPTURADAS (com --only, captura-se um subconjunto).
const compareKeys = sceneKeys.filter((k) => base[k])
let fail = 0
for (const k of compareKeys) {
  const d = diff(scenes[k], base[k])
  if (d !== 0) { fail++; console.error(`✖ ${k}: diff=${d}`) }
}
if (errored.length) { console.error(`✖ selfTest falhou em: ${errored.join(', ')}`); fail++ }
if (fail) { console.error(`\n${fail} cena(s) divergente(s) — NÃO deployar.`); process.exit(1) }
console.log(`✓ ${compareKeys.length} cena(s)${ONLY ? ` (filtro: ${ONLY})` : ''}: diff=0 em todas.`)
process.exit(0)

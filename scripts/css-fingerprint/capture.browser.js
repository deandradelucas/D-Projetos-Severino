/**
 * CSS Fingerprint Harness — captura de estilos computados para provar `diff=0`
 * numa migração de cascata (@layer) / remoção de !important.
 *
 * É um módulo de BROWSER: injete o conteúdo via Playwright `page.evaluate` (ou
 * cole no console) para instalar `window.__cssfp`. Validado 2026-06-07:
 * captura pseudo-elementos (::before/::after), congela animação/transição,
 * mascara voláteis (captura 2x), e detecta quebra plantada (diff>0).
 *
 * Cobre as lacunas do fingerprint estático apontadas pelo advogado-do-diabo:
 *  - pseudo-elementos (ícones/badges/divisores desenhados via ::before/::after)
 *  - máscara de conteúdo volátil (ex.: relógio em TIME.dashboard-hub__date::before)
 *  - exige auto-teste de quebra plantada (cssfp.selfTest) antes de confiar em diff=0
 *
 * NÃO cobre sozinho (precisa de CENAS — ver docs/css-fingerprint-harness.md):
 *  modais ABERTOS, :hover/:focus (via page.hover/focus do Playwright),
 *  estados de erro de formulário, @media print, prefers-reduced-motion.
 *  Cada cena = navegar/abrir-estado e então chamar baseline/check.
 */
;(function () {
  const PROPS = [
    'color','background-color','background-image','border-top-color','border-right-color','border-bottom-color','border-left-color',
    'border-top-width','border-right-width','border-bottom-width','border-left-width',
    'border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius',
    'box-shadow','opacity','font-size','font-weight','font-family','line-height','letter-spacing','text-align','text-transform','text-decoration-line','color-scheme',
    'padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left',
    'width','height','min-width','min-height','max-width','max-height',
    'display','flex-direction','flex-wrap','justify-content','align-items','gap','grid-template-columns',
    'position','top','right','bottom','left','z-index','overflow-x','overflow-y','transform',
    'background-clip','-webkit-text-fill-color','outline-color','outline-width','fill','stroke','backdrop-filter','filter',
    'white-space','text-overflow','object-fit','background-size','background-position','content',
  ]
  // Subárvores excluídas: gráficos (cor inline em SVG) e elementos animados.
  const EXCLUDE = 'svg,.recharts-wrapper,[class*="shimmer"],[class*="skeleton"],[class*="spark"],[class*="pulse"],[class*="orb"]'

  function capRaw(rootSel, theme) {
    if (theme) document.body.dataset.theme = theme
    const root = document.querySelector(rootSel)
    if (!root) return null
    const els = [root, ...root.querySelectorAll('*')].filter((el) => !el.closest(EXCLUDE))
    // Congela animação/transição (só na medição; produção mantém).
    els.forEach((el) => {
      el.style.setProperty('animation', 'none', 'important')
      el.style.setProperty('transition', 'none', 'important')
    })
    const rows = []
    for (const el of els) {
      const cls = typeof el.className === 'string' ? el.className : ''
      const cs = getComputedStyle(el)
      rows.push({ k: el.tagName + '.' + cls, v: PROPS.map((p) => cs.getPropertyValue(p)).join('|') })
      for (const pe of ['::before', '::after']) {
        const pcs = getComputedStyle(el, pe)
        const content = pcs.getPropertyValue('content')
        if (content && content !== 'none' && content !== 'normal') {
          rows.push({ k: el.tagName + '.' + cls + pe, v: PROPS.map((p) => pcs.getPropertyValue(p)).join('|') })
        }
      }
    }
    return rows
  }

  // Captura estável: 2x e marca como voláteis os índices que variam sozinhos
  // (ex.: relógio/data dinâmica em ::before). volMask = Set de índices a ignorar.
  function capStable(rootSel, theme) {
    const a = capRaw(rootSel, theme)
    const b = capRaw(rootSel, theme)
    if (!a || !b) return null
    const volMask = []
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) if (a[i].v !== b[i].v) volMask.push(i)
    return { rows: b, volMask }
  }

  function diff(curr, baseObj) {
    const base = baseObj.rows || baseObj
    const vol = new Set(baseObj.volMask || [])
    let d = 0
    const ex = []
    const n = Math.min(curr.length, base.length)
    for (let i = 0; i < n; i++) {
      if (vol.has(i)) continue
      if (curr[i].v !== base[i].v) {
        d++
        if (ex.length < 8) ex.push(curr[i].k.slice(0, 60))
      }
    }
    return { diff: d, curN: curr.length, baseN: base.length, lenMismatch: curr.length !== base.length, ex }
  }

  window.__cssfp = {
    PROPS,
    capRaw,
    capStable,
    diff,
    /** Auto-teste: prova que o harness ACUSA uma quebra (senão diff=0 é teatro). */
    selfTest(rootSel, theme) {
      const baseline = capStable(rootSel, theme)
      const st = document.createElement('style')
      st.id = '__cssfp_plant'
      st.textContent = `${rootSel}, ${rootSel} *{outline-width:7px !important}`
      document.head.appendChild(st)
      const broken = diff(capRaw(rootSel, theme), baseline)
      st.remove()
      const restored = diff(capRaw(rootSel, theme), baseline)
      return {
        detectouQuebra: broken.diff > 0,
        diffComQuebra: broken.diff,
        voltouAoZero: restored.diff === 0,
        diffRestaurado: restored.diff,
        ok: broken.diff > 0 && restored.diff === 0,
      }
    },
  }
  return 'window.__cssfp instalado'
})()

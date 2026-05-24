import { useState, useEffect, useCallback, useRef } from 'react'
import { getWhatsappOnboardingUrl } from '../../lib/whatsappContactUrl.js'

const TUTORIAL_KEY = 'horizonte_tutorial_transacao_visto'
const PAD          = 14   // padding ao redor do spotlight
const Z_BARS       = 10100
const Z_RING       = 10101
const Z_CARD       = 10102

export function tutorialDashboardFoiVisto() {
  try { return Boolean(localStorage.getItem(TUTORIAL_KEY)) }
  catch { return true }
}

function marcarVisto() {
  try { localStorage.setItem(TUTORIAL_KEY, '1') } catch {}
}

/** Retorna o DOMRect do PRIMEIRO elemento visível com esse data-tutorial-id.
 *  Ajusta pelo offsetTop do visualViewport para que elementos dentro de modais
 *  com teclado virtual aberto tenham coordenadas corretas para position:fixed. */
function getRectOf(id) {
  const els = document.querySelectorAll(`[data-tutorial-id="${id}"]`)
  const vvOffset = window.visualViewport?.offsetTop ?? 0
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      if (vvOffset === 0) return r
      // Quando o teclado está aberto o vv está deslocado; compensar para fixed
      return {
        top:    r.top    - vvOffset,
        bottom: r.bottom - vvOffset,
        left:   r.left,
        right:  r.right,
        width:  r.width,
        height: r.height,
      }
    }
  }
  return null
}

let _keyframesDone = false
function ensureKeyframes() {
  if (_keyframesDone || typeof document === 'undefined') return
  _keyframesDone = true
  const s = document.createElement('style')
  s.textContent = `
    @keyframes tut-glow {
      0%,100% { box-shadow: 0 0 0 9999px rgba(4,5,10,.90), 0 0 0 2px rgba(212,168,75,.80), 0 0 18px rgba(212,168,75,.22); }
      50%      { box-shadow: 0 0 0 9999px rgba(4,5,10,.90), 0 0 0 2.5px rgba(212,168,75,1), 0 0 36px rgba(212,168,75,.50); }
    }
    @keyframes tut-fadein {
      from { opacity:0; transform:translateY(6px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes tut-bounce {
      0%,100% { transform:translateY(0); }
      50%     { transform:translateY(-5px); }
    }
  `
  document.head.appendChild(s)
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuração por estágio
// ─────────────────────────────────────────────────────────────────────────────
const STAGES = {
  'btn-nova': {
    targetId:    'nova-transacao-btn',
    overlay:     true,
    badge:       'Primeiro passo',
    title:       'Registre sua primeira transação',
    body:        'Toque no botão destacado para abrir o formulário.',
    nextTrigger: null,
    nextStage:   null,
  },
  'dashboard-whatsapp': {
    targetId:    'whatsapp-btn',
    overlay:     true,
    forceAbove:  false,
    badge:       'Dica final',
    title:       'Converse pelo WhatsApp',
    body:        'Toque no botão e envie "ajuda" para o assistente — controle suas finanças direto pelo celular!',
    nextTrigger: null,
    ctaLabel:    'Abrir WhatsApp →',
    ctaUrl:      getWhatsappOnboardingUrl(),
    nextStage:   'done',
    nextDelay:   0,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes de layout
// ─────────────────────────────────────────────────────────────────────────────

function SpotlightBox({ t, l, r, b }) {
  return (
    <div
      aria-hidden
      style={{
        position:'fixed', top:t, left:l, width:Math.max(0,r-l), height:Math.max(0,b-t),
        borderRadius:8, zIndex:Z_BARS, pointerEvents:'none',
        animation:'tut-glow 1.8s ease-in-out infinite',
      }}
    />
  )
}

const FONT = "'Poppins', 'Inter', system-ui, sans-serif"

function TooltipCard({ rect, badge, title, body, ctaLabel, onCta, onSkip, skipLabel = 'Pular', showArrow = true, forceAbove = false }) {
  const vw         = typeof window !== 'undefined' ? window.innerWidth  : 800
  const vh         = typeof window !== 'undefined' ? window.innerHeight : 800
  // visualViewport.height shrinks when keyboard is open (iOS/Android); window.innerHeight doesn't on iOS
  const vvH        = typeof window !== 'undefined' ? (window.visualViewport?.height ?? vh) : vh
  const W          = Math.min(272, vw - 24)
  const spotCenterX = rect.left + (rect.right - rect.left) / 2
  const L          = Math.max(8, Math.min(spotCenterX - W / 2, vw - W - 8))
  // offset da seta dentro do card para apontar ao centro do elemento destacado
  const arrowLeft  = Math.max(7, Math.min(spotCenterX - L - 7, W - 14))

  const CARD_H = 160
  const below  = !forceAbove && rect.bottom + 10 + CARD_H < vvH
  const rawTop = below ? rect.bottom + 10 : rect.top - 10 - CARD_H
  // clamp: nunca sai da tela (nem acima nem abaixo do visual viewport)
  const top    = Math.max(8, Math.min(rawTop, vvH - CARD_H - 10))

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title}
      style={{ position:'fixed', top, left:L, width:W, zIndex:Z_CARD, animation:'tut-fadein .3s ease-out both', fontFamily:FONT }}
    >
      {showArrow && below && (
        <div aria-hidden style={{ marginLeft: arrowLeft, marginBottom:4, animation:'tut-bounce 1.4s ease-in-out infinite', width:14 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d4a84b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12V4M4 8l4-4 4 4" />
          </svg>
        </div>
      )}

      <div style={{
        background:'#0c0d11',
        border:'1px solid rgba(212,168,75,.18)',
        borderRadius:14,
        padding:'11px 14px 10px',
        boxShadow:'0 0 0 1px rgba(255,255,255,.03) inset, 0 0 30px -12px rgba(212,168,75,.14)',
        position:'relative',
      }}>
        <div aria-hidden style={{ position:'absolute', top:-1, left:18, right:18, height:1, background:'linear-gradient(90deg,transparent,rgba(212,168,75,.45),transparent)' }} />

        <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:20, background:'rgba(212,168,75,.10)', border:'1px solid rgba(212,168,75,.22)', marginBottom:6 }}>
          <span style={{ fontSize:8, fontWeight:700, color:'#d4a84b', textTransform:'uppercase', letterSpacing:'0.10em', fontFamily:FONT }}>{badge}</span>
        </div>

        <h2 style={{ margin:'0 0 4px', fontSize:13, fontWeight:600, color:'rgba(255,255,255,.92)', lineHeight:1.3, fontFamily:FONT }}>{title}</h2>
        <p  style={{ margin:'0 0 9px', fontSize:11, color:'rgba(255,255,255,.50)', lineHeight:1.55, fontFamily:FONT }}>{body}</p>

        {ctaLabel && onCta && (
          <button
            type="button"
            onClick={onCta}
            style={{
              width:'100%', padding:'8px 12px', borderRadius:9, border:'none',
              background:'linear-gradient(135deg,#d4a84b 0%,#c49535 100%)',
              color:'#1a1100', fontWeight:600, fontSize:12, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:4,
              marginBottom:6, fontFamily:FONT,
              boxShadow:'0 2px 10px rgba(212,168,75,.22)',
            }}
          >
            {ctaLabel}
          </button>
        )}

        {onSkip && (
          <button type="button" onClick={onSkip} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,.24)', fontSize:10, cursor:'pointer', padding:'1px 0', display:'block', width:'100%', textAlign:'center', fontFamily:FONT }}>
            {skipLabel}
          </button>
        )}
      </div>

      {showArrow && !below && (
        <div aria-hidden style={{ marginLeft: arrowLeft, marginTop:4, animation:'tut-bounce 1.4s ease-in-out infinite', width:14 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d4a84b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4v8M4 8l4 4 4-4" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function TutorialDashboard({ onDismiss, isModalOpen }) {
  const [stage,   setStage]   = useState('btn-nova')
  const [rect,    setRect]    = useState(null)
  const [visible, setVisible] = useState(true)
  const pendingStageRef       = useRef(null)
  const modalWasOpenRef       = useRef(false)

  useEffect(() => { ensureKeyframes() }, [])

  // Rastreia abertura do modal enquanto está no estágio btn-nova
  useEffect(() => {
    if (isModalOpen && stage === 'btn-nova') {
      modalWasOpenRef.current = true
    }
  }, [isModalOpen, stage])

  // Quando modal fecha após ter sido aberto → avança para WhatsApp
  useEffect(() => {
    if (!isModalOpen && modalWasOpenRef.current && stage === 'btn-nova') {
      modalWasOpenRef.current = false
      setStage('dashboard-whatsapp')
    }
  }, [isModalOpen, stage])

  // Recalcula rect quando o estágio muda ou a janela é redimensionada
  useEffect(() => {
    if (!visible || stage === 'done') return
    const cfg = STAGES[stage]
    if (!cfg) return

    let retries = 0
    let retryTimer = null

    function calc() {
      requestAnimationFrame(() => {
        const r = getRectOf(cfg.targetId)
        if (r) {
          // Só aceita rect se o elemento está visível no visual viewport
          // (evita posições erradas enquanto o teclado ainda está abrindo)
          const effH = window.visualViewport?.height ?? window.innerHeight
          if (r.bottom > 0 && r.top < effH) { setRect(r); return }
          // Fora do viewport — aguarda próxima chamada debounced
          return
        }
        // Elemento ausente: se skipIfMissing, tenta por até 400ms depois avança
        if (cfg.skipIfMissing && retries < 4) {
          retries++
          retryTimer = window.setTimeout(calc, 100)
        } else if (cfg.skipIfMissing) {
          setStage(cfg.nextStage)
        } else {
          setRect(null)
        }
      })
    }

    // Debounce para visualViewport — aguarda animação do teclado terminar
    let vvTimer = null
    function calcDebounced() {
      if (vvTimer) clearTimeout(vvTimer)
      // Esconde overlay imediatamente quando viewport muda (teclado abrindo/fechando)
      // Evita que o spotlight fique na posição antiga cobrindo o elemento deslocado
      setRect(null)
      vvTimer = setTimeout(calc, 350)
    }

    calc()
    const vv = window.visualViewport
    window.addEventListener('resize', calc)
    vv?.addEventListener('resize', calcDebounced)
    vv?.addEventListener('scroll', calcDebounced)
    return () => {
      window.removeEventListener('resize', calc)
      vv?.removeEventListener('resize', calcDebounced)
      vv?.removeEventListener('scroll', calcDebounced)
      if (retryTimer) window.clearTimeout(retryTimer)
      if (vvTimer) clearTimeout(vvTimer)
    }
  }, [stage, visible])

  // Listener de clique no elemento trigger do estágio atual
  useEffect(() => {
    if (!visible || stage === 'done') return
    const cfg = STAGES[stage]
    if (!cfg?.nextTrigger) return

    function onTriggerClick() {
      const { nextStage, nextDelay } = cfg
      if (nextDelay > 0) {
        pendingStageRef.current = window.setTimeout(() => {
          setStage(nextStage)
        }, nextDelay)
      } else {
        setStage(nextStage)
      }
    }

    const els = document.querySelectorAll(`[data-tutorial-id="${cfg.nextTrigger}"]`)
    els.forEach((el) => el.addEventListener('click', onTriggerClick, { once: true }))

    return () => {
      els.forEach((el) => el.removeEventListener('click', onTriggerClick))
      if (pendingStageRef.current) {
        window.clearTimeout(pendingStageRef.current)
        pendingStageRef.current = null
      }
    }
  }, [stage, visible])

  const dismiss = useCallback(() => {
    marcarVisto()
    setVisible(false)
    onDismiss?.()
  }, [onDismiss])

  const advanceStage = useCallback(() => {
    const cfg = STAGES[stage]
    if (!cfg?.nextStage) return
    if (cfg.nextStage === 'done') { dismiss() }
    else { setStage(cfg.nextStage) }
  }, [stage, dismiss])

  const handleCta = useCallback(() => {
    const cfg = STAGES[stage]
    if (cfg?.ctaUrl) window.open(cfg.ctaUrl, '_blank', 'noopener,noreferrer')
    advanceStage()
  }, [stage, advanceStage])

  if (!visible || stage === 'done' || !rect) return null

  const cfg = STAGES[stage]
  const T   = rect.top    - PAD
  const L   = rect.left   - PAD
  const R   = rect.right  + PAD
  const B   = rect.bottom + PAD

  return (
    <>
      {/* Spotlight arredondado: overlay escuro + borda dourada animada */}
      <SpotlightBox t={T} l={L} r={R} b={B} />

      {/* Tooltip */}
      <TooltipCard
        rect={{ top:T, bottom:B, left:L, right:R }}
        badge={cfg.badge}
        title={cfg.title}
        body={cfg.body}
        ctaLabel={cfg.ctaLabel}
        onCta={cfg.ctaLabel ? handleCta : undefined}
        forceAbove={cfg.forceAbove}
        onSkip={dismiss}
        skipLabel="Pular"
        showArrow
      />
    </>
  )
}

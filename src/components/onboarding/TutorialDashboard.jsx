import { useState, useEffect, useCallback, useRef } from 'react'

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

/** Retorna o DOMRect do PRIMEIRO elemento visível com esse data-tutorial-id */
function getRectOf(id) {
  const els = document.querySelectorAll(`[data-tutorial-id="${id}"]`)
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return r
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
      0%,100% { box-shadow: 0 0 0 2px rgba(212,168,75,.80), 0 0 18px rgba(212,168,75,.22); }
      50%      { box-shadow: 0 0 0 2.5px rgba(212,168,75,1), 0 0 36px rgba(212,168,75,.50); }
    }
    @keyframes tut-fadein {
      from { opacity:0; transform:translateY(6px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes tut-bounce {
      0%,100% { transform:translateY(0); }
      50%     { transform:translateY(-5px); }
    }
    @keyframes tut-ring-pulse {
      0%,100% { box-shadow: 0 0 0 3px rgba(212,168,75,.70), 0 0 24px rgba(212,168,75,.30); }
      50%      { box-shadow: 0 0 0 4px rgba(212,168,75,1),   0 0 40px rgba(212,168,75,.55); }
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
    nextTrigger: 'nova-transacao-btn', // data-tutorial-id do elemento que dispara a transição
    nextStage:   'modal-receita',
    nextDelay:   320,                  // aguarda o modal terminar de abrir
  },
  'modal-receita': {
    targetId:    'tipo-receita-btn',
    overlay:     false,
    badge:       'Cadastre seu saldo atual',
    title:       'Selecione Receita',
    body:        'Toque em Receita e cadastre o saldo atual das suas contas bancárias — o valor que você tem disponível hoje.',
    nextTrigger: 'tipo-receita-btn',
    nextStage:   'modal-categoria',
    nextDelay:   0,
  },
  'modal-categoria': {
    targetId:    'categoria-selector',
    overlay:     false,
    forceAbove:  true,
    badge:       'Organize sua receita',
    title:       'Escolha a categoria',
    body:        'Selecione a categoria que melhor representa essa receita. Experimente cadastrar Saldo.',
    nextTrigger: null,
    ctaLabel:    'Já escolhi →',
    nextStage:   'modal-subcategoria',
    nextDelay:   0,
  },
  'modal-subcategoria': {
    targetId:    'subcategoria-selector',
    overlay:     false,
    forceAbove:  true,
    badge:       'Detalhe sua receita',
    title:       'Escolha a subcategoria',
    body:        'Experimente utilizar Saldo Atual e depois vá para Valor.',
    nextTrigger: null,
    ctaLabel:    'Ir para Valor →',
    nextStage:   'modal-valor',
    nextDelay:   0,
    skipIfMissing: true,          // pula para nextStage se o elemento não estiver visível
  },
  'modal-valor': {
    targetId:    'tx-valor-input',
    overlay:     false,
    badge:       'Quanto você tem hoje?',
    title:       'Informe o saldo total',
    body:        'Some o saldo de todas as suas contas e coloque o total aqui.',
    nextTrigger: null,
    nextStage:   'done',
    nextDelay:   0,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes de layout
// ─────────────────────────────────────────────────────────────────────────────

function OverlayBars({ t, l, r, b }) {
  const bg = 'rgba(4, 5, 10, .90)'
  return (
    <>
      <div aria-hidden style={{ position:'fixed', inset:0, bottom:'auto', height: Math.max(0,t), background:bg, zIndex:Z_BARS, pointerEvents:'all' }} />
      <div aria-hidden style={{ position:'fixed', top:b,  left:0, right:0, bottom:0, background:bg, zIndex:Z_BARS, pointerEvents:'all' }} />
      <div aria-hidden style={{ position:'fixed', top:t, left:0, width:Math.max(0,l), height:b-t, background:bg, zIndex:Z_BARS, pointerEvents:'all' }} />
      <div aria-hidden style={{ position:'fixed', top:t, left:r, right:0, height:b-t, background:bg, zIndex:Z_BARS, pointerEvents:'all' }} />
    </>
  )
}

function GlowRing({ t, l, r, b, ring }) {
  return (
    <div
      aria-hidden
      style={{
        position:'fixed', top:t, left:l, width:r-l, height:b-t,
        borderRadius:14, zIndex:Z_RING, pointerEvents:'none',
        animation: ring ? 'tut-ring-pulse 1.8s ease-in-out infinite' : 'tut-glow 1.8s ease-in-out infinite',
        boxShadow: ring
          ? '0 0 0 3px rgba(212,168,75,.70), 0 0 24px rgba(212,168,75,.30)'
          : '0 0 0 2px rgba(212,168,75,.80), 0 0 18px rgba(212,168,75,.22)',
      }}
    />
  )
}

function TooltipCard({ rect, badge, title, body, ctaLabel, onCta, onSkip, skipLabel = 'Pular', showArrow = true, forceAbove = false }) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const W  = Math.min(300, vw - 32)
  const L  = Math.max(12, Math.min(rect.left + (rect.right - rect.left) / 2 - W / 2, vw - W - 12))

  const CARD_H  = 200
  const below   = !forceAbove && rect.bottom + 14 + CARD_H < vh
  const top     = below ? rect.bottom + 14 : rect.top - 14 - CARD_H

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title}
      style={{ position:'fixed', top, left:L, width:W, zIndex:Z_CARD, animation:'tut-fadein .3s ease-out both' }}
    >
      {/* seta para cima */}
      {showArrow && below && (
        <div aria-hidden style={{ display:'flex', justifyContent:'center', marginBottom:6, animation:'tut-bounce 1.4s ease-in-out infinite' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#d4a84b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12V4M4 8l4-4 4 4" />
          </svg>
        </div>
      )}

      <div style={{
        background:'#0c0d11',
        border:'1px solid rgba(212,168,75,.18)',
        borderRadius:18,
        padding:'16px 18px 14px',
        boxShadow:'0 0 0 1px rgba(255,255,255,.03) inset, 0 24px 48px -12px rgba(0,0,0,.95), 0 0 40px -15px rgba(212,168,75,.14)',
        position:'relative',
      }}>
        <div aria-hidden style={{ position:'absolute', top:-1, left:24, right:24, height:1, background:'linear-gradient(90deg,transparent,rgba(212,168,75,.50),transparent)' }} />

        <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:20, background:'rgba(212,168,75,.10)', border:'1px solid rgba(212,168,75,.24)', marginBottom:8 }}>
          <span style={{ fontSize:9, fontWeight:700, color:'#d4a84b', textTransform:'uppercase', letterSpacing:'0.09em' }}>{badge}</span>
        </div>

        <h2 style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:'rgba(255,255,255,.92)', lineHeight:1.3 }}>{title}</h2>
        <p  style={{ margin:'0 0 12px', fontSize:12, color:'rgba(255,255,255,.48)', lineHeight:1.6 }}>{body}</p>

        {ctaLabel && onCta && (
          <button
            type="button"
            onClick={onCta}
            style={{
              width:'100%', padding:'10px 16px', borderRadius:12, border:'none',
              background:'linear-gradient(135deg,#d4a84b 0%,#c49535 100%)',
              color:'#1a1100', fontWeight:700, fontSize:13, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:5,
              marginBottom:8,
              boxShadow:'0 3px 14px rgba(212,168,75,.25)',
            }}
          >
            {ctaLabel}
          </button>
        )}

        {onSkip && (
          <button type="button" onClick={onSkip} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,.26)', fontSize:11, cursor:'pointer', padding:'2px 0', display:'block', width:'100%', textAlign:'center' }}>
            {skipLabel}
          </button>
        )}
      </div>

      {/* seta para baixo */}
      {showArrow && !below && (
        <div aria-hidden style={{ display:'flex', justifyContent:'center', marginTop:6, animation:'tut-bounce 1.4s ease-in-out infinite' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#d4a84b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  useEffect(() => { ensureKeyframes() }, [])

  // Quando o modal fecha enquanto estamos num estágio dentro dele → volta ao estágio inicial
  useEffect(() => {
    if (!isModalOpen && (stage === 'modal-receita' || stage === 'modal-categoria' || stage === 'modal-subcategoria' || stage === 'modal-valor')) {
      if (pendingStageRef.current) {
        window.clearTimeout(pendingStageRef.current)
        pendingStageRef.current = null
      }
      setStage('btn-nova')
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
        if (r) { setRect(r); return }
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
    calc()
    window.addEventListener('resize', calc)
    return () => {
      window.removeEventListener('resize', calc)
      if (retryTimer) window.clearTimeout(retryTimer)
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

  if (!visible || stage === 'done' || !rect) return null

  const cfg = STAGES[stage]
  const T   = rect.top    - PAD
  const L   = rect.left   - PAD
  const R   = rect.right  + PAD
  const B   = rect.bottom + PAD

  return (
    <>
      {/* Overlay bloqueante (só no estágio do Dashboard) */}
      {cfg.overlay && <OverlayBars t={T} l={L} r={R} b={B} />}

      {/* Anel de destaque */}
      <GlowRing t={T} l={L} r={R} b={B} ring={!cfg.overlay} />

      {/* Tooltip */}
      <TooltipCard
        rect={{ top:T, bottom:B, left:L, right:R }}
        badge={cfg.badge}
        title={cfg.title}
        body={cfg.body}
        ctaLabel={cfg.ctaLabel}
        onCta={cfg.ctaLabel ? advanceStage : undefined}
        forceAbove={cfg.forceAbove}
        onSkip={dismiss}
        skipLabel={stage === 'modal-valor' ? 'Fechar dica' : 'Pular'}
        showArrow
      />
    </>
  )
}

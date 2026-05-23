import { useState, useEffect, useCallback } from 'react'

const TUTORIAL_KEY = 'horizonte_tutorial_transacao_visto'
const PAD = 14

export function tutorialDashboardFoiVisto() {
  try { return Boolean(localStorage.getItem(TUTORIAL_KEY)) }
  catch { return true }
}

function marcarVisto() {
  try { localStorage.setItem(TUTORIAL_KEY, '1') } catch {}
}

function findTargetRect() {
  const els = document.querySelectorAll('[data-tutorial-id="nova-transacao-btn"]')
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return r
  }
  return null
}

const BG = 'rgba(4, 5, 10, 0.90)'

/** Injeta o keyframe uma única vez no documento */
let keyframesInjected = false
function ensureKeyframes() {
  if (keyframesInjected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.textContent = `
    @keyframes tutorial-glow {
      0%, 100% { box-shadow: 0 0 0 2px rgba(212,168,75,0.80), 0 0 18px rgba(212,168,75,0.22); }
      50%       { box-shadow: 0 0 0 2.5px rgba(212,168,75,1),   0 0 32px rgba(212,168,75,0.45); }
    }
    @keyframes tutorial-fadein {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes tutorial-arrow-bounce {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-4px); }
    }
  `
  document.head.appendChild(style)
  keyframesInjected = true
}

export default function TutorialDashboard({ onDismiss }) {
  const [rect, setRect]       = useState(null)
  const [visible, setVisible] = useState(true)

  // Calcula e re-calcula rect ao montar e no resize
  useEffect(() => {
    ensureKeyframes()

    function calc() {
      // Pequeno delay para garantir que o DOM esteja pintado
      requestAnimationFrame(() => setRect(findTargetRect()))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // Escuta clique no botão alvo para auto-fechar
  useEffect(() => {
    if (!visible) return
    function handleBtnClick() {
      marcarVisto()
      setVisible(false)
      onDismiss?.()
    }
    const els = document.querySelectorAll('[data-tutorial-id="nova-transacao-btn"]')
    els.forEach((el) => el.addEventListener('click', handleBtnClick, { once: true }))
    return () => els.forEach((el) => el.removeEventListener('click', handleBtnClick))
  }, [visible, onDismiss])

  const handleSkip = useCallback(() => {
    marcarVisto()
    setVisible(false)
    onDismiss?.()
  }, [onDismiss])

  if (!visible || !rect) return null

  const T = rect.top    - PAD
  const L = rect.left   - PAD
  const R = rect.right  + PAD
  const B = rect.bottom + PAD
  const W = R - L
  const H = B - T

  // Decide se o tooltip vai abaixo ou acima do botão
  const vw = window.innerWidth
  const vh = window.innerHeight
  const tooltipBelow = T + H + 12 + 180 < vh  // 180 = altura estimada do card
  const tooltipW = Math.min(300, vw - 32)
  const tooltipL = Math.max(12, Math.min(L + W / 2 - tooltipW / 2, vw - tooltipW - 12))
  const tooltipTop = tooltipBelow ? B + 12 : T - 12 - 180

  return (
    <>
      {/* ── 4 barras de overlay — bloqueiam toda interação exceto a janela do botão ── */}
      {/* Topo */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, bottom: 'auto', height: Math.max(0, T), background: BG, zIndex: 1000, pointerEvents: 'all' }} />
      {/* Rodapé */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, top: 'auto', top: B, background: BG, zIndex: 1000, pointerEvents: 'all' }} />
      {/* Esquerda */}
      <div aria-hidden style={{ position: 'fixed', top: T, left: 0, width: Math.max(0, L), height: H, background: BG, zIndex: 1000, pointerEvents: 'all' }} />
      {/* Direita */}
      <div aria-hidden style={{ position: 'fixed', top: T, left: R, right: 0, height: H, background: BG, zIndex: 1000, pointerEvents: 'all' }} />

      {/* ── Anel de destaque pulsante ── */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: T,
          left: L,
          width: W,
          height: H,
          borderRadius: 14,
          zIndex: 1001,
          pointerEvents: 'none',
          animation: 'tutorial-glow 2s ease-in-out infinite',
          boxShadow: '0 0 0 2px rgba(212,168,75,0.80), 0 0 18px rgba(212,168,75,0.22)',
        }}
      />

      {/* ── Tooltip card ── */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Dica: como criar uma transação"
        style={{
          position: 'fixed',
          top: tooltipTop,
          left: tooltipL,
          width: tooltipW,
          zIndex: 1002,
          animation: 'tutorial-fadein 0.3s ease-out both',
        }}
      >
        {/* Seta apontando para o botão */}
        {tooltipBelow && (
          <div
            aria-hidden
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 6,
              animation: 'tutorial-arrow-bounce 1.4s ease-in-out infinite',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#d4a84b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14V4M4 9l5-5 5 5" />
            </svg>
          </div>
        )}

        {/* Card */}
        <div
          style={{
            background: '#0c0d11',
            border: '1px solid rgba(212,168,75,0.18)',
            borderRadius: 18,
            padding: '16px 18px 14px',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset, 0 24px 48px -12px rgba(0,0,0,0.95), 0 0 40px -15px rgba(212,168,75,0.14)',
            position: 'relative',
          }}
        >
          {/* Linha dourada no topo */}
          <div aria-hidden style={{ position: 'absolute', top: -1, left: 24, right: 24, height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,168,75,0.50), transparent)' }} />

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            borderRadius: 20,
            background: 'rgba(212,168,75,0.10)',
            border: '1px solid rgba(212,168,75,0.24)',
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#d4a84b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Primeiro passo
            </span>
          </div>

          <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.92)', lineHeight: 1.3 }}>
            Registre sua primeira transação
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.48)', lineHeight: 1.6 }}>
            Toque no botão destacado acima. O formulário leva menos de 20 segundos.
          </p>

          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.26)',
              fontSize: 11,
              cursor: 'pointer',
              padding: '2px 0',
              display: 'block',
              width: '100%',
              textAlign: 'center',
              letterSpacing: '0.02em',
            }}
          >
            Pular
          </button>
        </div>

        {/* Seta apontando para baixo (quando botão está acima do tooltip) */}
        {!tooltipBelow && (
          <div
            aria-hidden
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 6,
              animation: 'tutorial-arrow-bounce 1.4s ease-in-out infinite',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#d4a84b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4v10M4 9l5 5 5-5" />
            </svg>
          </div>
        )}
      </div>
    </>
  )
}

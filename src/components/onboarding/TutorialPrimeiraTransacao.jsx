import { useState, useEffect, useCallback } from 'react'

const TUTORIAL_KEY = 'horizonte_tutorial_transacao_visto'
const SPOTLIGHT_PAD = 12

export function tutorialTransacaoFoiVisto() {
  try { return Boolean(localStorage.getItem(TUTORIAL_KEY)) }
  catch { return true }
}

function marcarVisto() {
  try { localStorage.setItem(TUTORIAL_KEY, '1') } catch {}
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 4,
            width: i === current ? 20 : 4,
            borderRadius: 4,
            background: i === current
              ? 'linear-gradient(90deg, #d4a84b, #c49535)'
              : 'rgba(255,255,255,0.14)',
            transition: 'all 0.3s ease',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}

function FieldsPreview() {
  const fields = [
    {
      label: 'Tipo',
      value: 'Despesa  •  Receita',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#d4a84b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 2v10M3 6l4-4 4 4M3 8l4 4 4-4" />
        </svg>
      ),
    },
    {
      label: 'Categoria',
      value: 'Alimentação, Transporte…',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#818cf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="4" height="4" rx="1" />
          <rect x="8" y="2" width="4" height="4" rx="1" />
          <rect x="2" y="8" width="4" height="4" rx="1" />
          <rect x="8" y="8" width="4" height="4" rx="1" />
        </svg>
      ),
    },
    {
      label: 'Valor',
      value: 'R$ 0,00',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 1v12M4 4h4.5a2.5 2.5 0 0 1 0 5H4" />
        </svg>
      ),
    },
    {
      label: 'Data',
      value: 'Hoje',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="10" height="9" rx="2" />
          <path d="M5 2v2M9 2v2M2 6h10" />
        </svg>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '14px 0' }}>
      {fields.map((f) => (
        <div
          key={f.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {f.icon}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1 }}>
              {f.label}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
              {f.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CardBase({ children, style }) {
  return (
    <div
      style={{
        background: '#0c0d11',
        border: '1px solid rgba(212,168,75,0.16)',
        borderRadius: 24,
        padding: '24px 24px 20px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset, 0 32px 64px -16px rgba(0,0,0,0.9), 0 0 60px -20px rgba(212,168,75,0.10)',
        position: 'relative',
        ...style,
      }}
    >
      {/* Linha dourada no topo */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -1,
          left: 32,
          right: 32,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(212,168,75,0.45), transparent)',
          borderRadius: 1,
        }}
      />
      {children}
    </div>
  )
}

// ── Dados dos steps ──────────────────────────────────────────────────────────

const TOTAL_STEPS = 4

const STEP_META = [
  { id: 'welcome', spotlight: false, skipLabel: 'Pular tutorial' },
  { id: 'button',  spotlight: true,  skipLabel: 'Pular' },
  { id: 'form',    spotlight: false, skipLabel: 'Pular' },
  { id: 'cta',     spotlight: false, skipLabel: null },
]

// ── Conteúdo de cada step ────────────────────────────────────────────────────

function StepContent({ step, onNext, onSkip }) {
  if (step === 0) {
    return (
      <>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 16,
            background: 'rgba(212,168,75,0.10)',
            border: '1px solid rgba(212,168,75,0.22)',
            marginBottom: 14,
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#d4a84b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 2a9 9 0 1 0 0 18A9 9 0 0 0 11 2z" />
              <path d="M11 7v5l3 3" />
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.92)', lineHeight: 1.3 }}>
            Registre sua primeira transação
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.48)', lineHeight: 1.55 }}>
            Anotar cada entrada e saída é o primeiro passo para entender onde seu dinheiro vai. Mostramos como em menos de 1 minuto.
          </p>
        </div>

        <ProgressBar current={0} total={TOTAL_STEPS} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onNext}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #d4a84b 0%, #c49535 100%)',
              color: '#1a1100',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(212,168,75,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            Vamos lá
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 7h10M8 3l4 4-4 4" />
            </svg>
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.28)',
                fontSize: 12,
                cursor: 'pointer',
                padding: '6px 0',
                textAlign: 'center',
              }}
            >
              Pular tutorial
            </button>
          )}
        </div>
      </>
    )
  }

  if (step === 1) {
    return (
      <>
        {/* Seta para cima */}
        <div aria-hidden style={{ textAlign: 'center', marginBottom: 6 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#d4a84b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 14V2M3 7l5-5 5 5" />
          </svg>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            background: 'rgba(212,168,75,0.10)',
            border: '1px solid rgba(212,168,75,0.22)',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#d4a84b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Passo 1 de 3
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.90)', lineHeight: 1.3 }}>
            Este botão é o início de tudo
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.48)', lineHeight: 1.55 }}>
            Clique em <strong style={{ color: 'rgba(255,255,255,0.70)' }}>+ Nova transação</strong> para abrir o formulário. Serve para despesas e receitas.
          </p>
        </div>

        <ProgressBar current={1} total={TOTAL_STEPS} />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.09)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.40)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Pular
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            style={{
              flex: 2,
              padding: '10px 16px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #d4a84b 0%, #c49535 100%)',
              color: '#1a1100',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            Próximo
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6h8M6 2l4 4-4 4" />
            </svg>
          </button>
        </div>
      </>
    )
  }

  if (step === 2) {
    return (
      <>
        <div style={{ marginBottom: 4 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            background: 'rgba(212,168,75,0.10)',
            border: '1px solid rgba(212,168,75,0.22)',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#d4a84b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Passo 2 de 3
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.90)', lineHeight: 1.3 }}>
            Preencha 4 campos rápidos
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            O formulário pede só o essencial.
          </p>
        </div>

        <FieldsPreview />

        <ProgressBar current={2} total={TOTAL_STEPS} />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.09)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.40)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Pular
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            style={{
              flex: 2,
              padding: '10px 16px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #d4a84b 0%, #c49535 100%)',
              color: '#1a1100',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            Próximo
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6h8M6 2l4 4-4 4" />
            </svg>
          </button>
        </div>
      </>
    )
  }

  // Step 3 — CTA final
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 16,
          background: 'rgba(52,211,153,0.10)',
          border: '1px solid rgba(52,211,153,0.22)',
          marginBottom: 14,
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11l5 5 9-9" />
          </svg>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 20,
          background: 'rgba(212,168,75,0.10)',
          border: '1px solid rgba(212,168,75,0.22)',
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#d4a84b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Passo 3 de 3
          </span>
        </div>

        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.92)', lineHeight: 1.3 }}>
          Pronto — agora é sua vez
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.48)', lineHeight: 1.55 }}>
          Em menos de 20 segundos você já tem sua primeira transação registrada. Vamos tentar?
        </p>
      </div>

      <ProgressBar current={3} total={TOTAL_STEPS} />

      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={onNext}
          style={{
            width: '100%',
            padding: '13px 16px',
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, #d4a84b 0%, #c49535 100%)',
            color: '#1a1100',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(212,168,75,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          Abrir formulário
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 7h10M8 3l4 4-4 4" />
          </svg>
        </button>
      </div>
    </>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function TutorialPrimeiraTransacao({ onComplete }) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)
  const [spotlightRect, setSpotlightRect] = useState(null)

  const meta = STEP_META[step]

  // Calcula posição do spotlight quando step = 1
  useEffect(() => {
    if (step !== 1) {
      setSpotlightRect(null)
      return
    }
    function calcRect() {
      const el = document.querySelector('[data-tutorial-id="nova-transacao-btn"]')
      if (!el) return
      const r = el.getBoundingClientRect()
      setSpotlightRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    calcRect()
    window.addEventListener('resize', calcRect)
    return () => window.removeEventListener('resize', calcRect)
  }, [step])

  const dismiss = useCallback(() => {
    marcarVisto()
    setVisible(false)
  }, [])

  const handleNext = useCallback(() => {
    if (step === TOTAL_STEPS - 1) {
      marcarVisto()
      setVisible(false)
      onComplete?.()
    } else {
      setStep((s) => s + 1)
    }
  }, [step, onComplete])

  if (!visible) return null

  const isSpotlight = step === 1 && spotlightRect

  // ── Posicionamento do card de spotlight ──────────────────────────────────
  let spotlightCardStyle = null
  if (isSpotlight) {
    const cardWidth = 300
    const gap = 14
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800
    const rawLeft = spotlightRect.left + spotlightRect.width / 2 - cardWidth / 2
    const clampedLeft = Math.max(12, Math.min(rawLeft, vw - cardWidth - 12))
    // Posiciona abaixo da seleção; se não houver espaço, sobe acima
    const cardTop = spotlightRect.top + spotlightRect.height + SPOTLIGHT_PAD + gap
    const estimatedCardHeight = 220
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const finalTop = cardTop + estimatedCardHeight > vh - 20
      ? spotlightRect.top - SPOTLIGHT_PAD - gap - estimatedCardHeight
      : cardTop
    spotlightCardStyle = { top: finalTop, left: clampedLeft, width: cardWidth }
  }

  return (
    <>
      {/* ── Overlay / Spotlight ── */}
      {isSpotlight ? (
        // Spotlight via box-shadow — o elemento em si é o "buraco" transparente
        <div
          aria-hidden
          style={{
            position: 'fixed',
            top: spotlightRect.top - SPOTLIGHT_PAD,
            left: spotlightRect.left - SPOTLIGHT_PAD,
            width: spotlightRect.width + SPOTLIGHT_PAD * 2,
            height: spotlightRect.height + SPOTLIGHT_PAD * 2,
            borderRadius: 14,
            zIndex: 1000,
            boxShadow: '0 0 0 9999px rgba(4,5,10,0.88)',
            outline: '2px solid rgba(212,168,75,0.55)',
            outlineOffset: -2,
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(4,5,10,0.85)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ── Card ── */}
      {isSpotlight ? (
        // Card posicionado próximo ao spotlight
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tutorial: como criar uma transação"
          style={{
            position: 'fixed',
            zIndex: 1001,
            ...spotlightCardStyle,
          }}
        >
          <CardBase>
            <StepContent step={step} onNext={handleNext} onSkip={meta.skipLabel ? dismiss : null} />
          </CardBase>
        </div>
      ) : (
        // Card centralizado
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tutorial: como criar uma transação"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'all', width: '100%', maxWidth: 380 }}>
            <CardBase>
              <StepContent step={step} onNext={handleNext} onSkip={meta.skipLabel ? dismiss : null} />
            </CardBase>
          </div>
        </div>
      )}
    </>
  )
}

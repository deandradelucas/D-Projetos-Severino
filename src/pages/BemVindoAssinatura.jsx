import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'

function readUser() {
  try {
    const raw = localStorage.getItem('horizonte_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function mergeUser(patch) {
  const u = readUser()
  if (!u) return
  localStorage.setItem('horizonte_user', JSON.stringify({ ...u, ...patch }))
}

const TRANSFORMACOES = [
  'Para onde vai cada centavo, em tempo real',
  'Quais hábitos estão te custando mais do que parece',
  'Pelo WhatsApp, quando e onde você quiser',
]

export default function BemVindoAssinatura() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const user = readUser()
  const dias = Number(user?.trial_dias_gratis) || 7
  const trialEnd = user?.trial_ends_at ? new Date(user.trial_ends_at) : null
  const trialEndStr =
    trialEnd && !Number.isNaN(trialEnd.getTime())
      ? trialEnd.toLocaleString('pt-BR', { dateStyle: 'long' })
      : null

  useEffect(() => {
    const u = readUser()
    if (!u?.id) {
      navigate('/login', { replace: true })
      return
    }
    if (u.mostrar_bem_vindo_assinatura === false) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const u = readUser()
      if (!u?.id) return
      try {
        const res = await apiFetch(apiUrl('/api/assinatura/status'), {
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const a = await res.json()
        mergeUser(a)
        if (a.mostrar_bem_vindo_assinatura === false) {
          navigate('/dashboard', { replace: true })
        }
      } catch {
        /* mantém fluxo local */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleEntrarNoApp = async () => {
    setErr('')
    const u = readUser()
    if (!u?.id) {
      navigate('/login')
      return
    }
    setBusy(true)
    try {
      const res = await apiFetch(apiUrl('/api/assinatura/bem-vindo-visto'), {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Não foi possível continuar.')
      mergeUser({
        bem_vindo_pagamento_visto_at: data.bem_vindo_pagamento_visto_at,
        mostrar_bem_vindo_assinatura: data.mostrar_bem_vindo_assinatura,
        assinatura_paga: data.assinatura_paga,
        acesso_app_liberado: data.acesso_app_liberado,
        trial_ends_at: data.trial_ends_at,
        trial_dias_gratis: data.trial_dias_gratis,
      })
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setErr(e.message || 'Erro ao continuar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="relative flex min-h-[100dvh] min-h-[100svh] w-full items-center justify-center overflow-y-auto px-4 py-5"
      style={{ backgroundColor: '#08090d' }}
    >
      {/* Fundo */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{ background: 'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(212,168,75,0.16) 0%, transparent 60%)' }}
      />

      <div className="relative w-full max-w-[420px]">
        <div
          className="absolute -top-px left-10 right-10 h-px"
          aria-hidden
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,168,75,0.50), transparent)' }}
        />

        <div
          className="relative rounded-[24px] px-5 pb-5 pt-5"
          style={{
            background: '#0b0c10',
            border: '1px solid rgba(212,168,75,0.14)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset, 0 40px 80px -20px rgba(0,0,0,0.92), 0 0 90px -30px rgba(212,168,75,0.12)',
          }}
        >
          {/* Topo: logo + badge */}
          <div className="mb-4 text-center">
            <img
              src={BRAND_ASSETS.logo}
              alt="Severino"
              className="mx-auto mb-3 h-auto w-full max-w-[150px] object-contain"
            />
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-[4px] text-[10px] font-semibold uppercase tracking-widest"
              style={{ background: 'rgba(212,168,75,0.10)', border: '1px solid rgba(212,168,75,0.26)', color: '#d4a84b' }}
            >
              <span className="relative flex h-[6px] w-[6px] shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ background: '#d4a84b' }} />
                <span className="relative inline-flex h-[6px] w-[6px] rounded-full" style={{ background: '#d4a84b' }} />
              </span>
              Conta criada — acesso liberado
            </span>
          </div>

          {/* Headline */}
          <div className="mb-4 text-center">
            <h1
              className="mb-1.5 text-[20px] font-bold leading-tight tracking-tight"
              style={{
                background: 'linear-gradient(140deg, #f0c96e 0%, #d4a84b 50%, #b8832a 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Seu dinheiro tem uma resposta agora.
            </h1>
            <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.42)' }}>
              Chega de chegar no dia 20 sem saber pra onde foi.{' '}
              <span style={{ color: 'rgba(255,255,255,0.62)' }}>O Severino te mostra tudo, em tempo real.</span>
            </p>
          </div>

          {/* Bullets */}
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(212,168,75,0.60)' }}>
            Com o Severino você sabe exatamente:
          </p>
          <ul className="mb-4 space-y-2">
            {TRANSFORMACOES.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[12px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
                <span
                  className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'rgba(212,168,75,0.12)', border: '1px solid rgba(212,168,75,0.24)' }}
                >
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M2 5.5l2 2 4-4" stroke="#d4a84b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          {/* Trial */}
          <div
            className="mb-4 rounded-[14px] px-4 py-3"
            style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.16)' }}
          >
            <p className="text-[12px] font-semibold" style={{ color: 'rgba(34,197,94,0.85)' }}>
              {dias} dias grátis — sem cartão agora.
            </p>
            <p className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.36)' }}>
              Use tudo. Se não gostar, cancele com um clique — sem formulário, sem explicação.
              {trialEndStr && (
                <> Acesso até <strong style={{ color: 'rgba(255,255,255,0.55)' }}>{trialEndStr}</strong>.</>
              )}
            </p>
          </div>

          {/* Erro */}
          {err && (
            <p className="mb-3 text-center text-[12px]" style={{ color: '#f87171' }}>{err}</p>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-1">
            <Link
              to="/pagamento"
              className="flex w-full items-center justify-center gap-2 rounded-[13px] py-3 text-[13px] font-semibold no-underline transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #d4a84b 0%, #c49535 100%)',
                color: '#1a1200',
                boxShadow: '0 4px 24px rgba(212,168,75,0.28), 0 1px 0 rgba(255,255,255,0.18) inset',
              }}
            >
              Garantir meu acesso completo
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none" aria-hidden>
                <path d="M2.5 6.5h8M6.5 3l3.5 3.5L6.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <p className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.24)' }}>
              Cancele quando quiser · Sem burocracia
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={handleEntrarNoApp}
              className="w-full py-1.5 text-center text-[12px] transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.28)' }}
            >
              {busy ? 'Entrando…' : 'Continuar explorando por agora'}
            </button>
          </div>

          {/* Trust footer */}
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none" aria-hidden style={{ color: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
              <rect x="1.5" y="4.5" width="8" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1" />
              <path d="M3.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
              Sem fidelidade · Asaas (cartão, Pix)
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

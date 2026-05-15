import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { apiUrl } from '../lib/apiUrl'
import { horizonteApiAuthHeaders } from '../lib/apiAuthHeaders'

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

export default function BemVindoAssinatura() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const user = readUser()
  const dias = Number(user?.trial_dias_gratis) || 7
  const trialEnd = user?.trial_ends_at ? new Date(user.trial_ends_at) : null
  const trialEndStr =
    trialEnd && !Number.isNaN(trialEnd.getTime()) ? trialEnd.toLocaleString('pt-BR', { dateStyle: 'long' }) : null

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
        const res = await fetch(apiUrl('/api/assinatura/status'), {
          headers: horizonteApiAuthHeaders(),
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
      const res = await fetch(apiUrl('/api/assinatura/bem-vindo-visto'), {
        method: 'POST',
        headers: horizonteApiAuthHeaders(),
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
    <div className="bem-vindo-page relative flex min-h-[100dvh] min-h-[100svh] w-full items-center justify-center overflow-hidden p-4 sm:p-6" style={{ backgroundColor: '#000000' }}>

      {/* ── Fundo escuro base ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden style={{ background: '#08090d' }} />

      {/* ── Spotlight gold vindo do topo ── */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(212,168,75,0.22) 0%, transparent 65%)' }}
      />

      {/* ── Acentos de canto ── */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 45% 35% at 100% 100%, rgba(212,168,75,0.06) 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 0% 85%, rgba(99,102,241,0.07) 0%, transparent 50%)',
        }}
      />

      {/* ── Card ── */}
      <div className="relative w-full max-w-[420px]">

        {/* Linha de brilho no topo do card */}
        <div
          className="absolute -top-px left-10 right-10 h-px"
          aria-hidden
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,168,75,0.65), transparent)' }}
        />

        <div
          className="relative rounded-[24px] px-6 py-5 sm:px-7 sm:py-6"
          style={{
            background: '#000000',
            border: '1px solid rgba(212,168,75,0.18)',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 72px -16px rgba(0,0,0,0.90), 0 0 80px -25px rgba(212,168,75,0.18)',
          }}
        >

          {/* Logo */}
          <div className="flex justify-center">
            <img src={BRAND_ASSETS.logo} alt="Severino" className="w-full max-w-[500px] h-auto object-contain" />
          </div>

          {/* Badge "Acesso liberado" com dot pulsante */}
          <div className="mb-3 mt-3 flex justify-center">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-[5px] text-[11px] font-semibold uppercase tracking-widest"
              style={{
                background: 'rgba(212,168,75,0.10)',
                border: '1px solid rgba(212,168,75,0.26)',
                color: '#d4a84b',
              }}
            >
              <span className="relative flex h-[7px] w-[7px] shrink-0 items-center justify-center">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
                  style={{ background: '#d4a84b' }}
                />
                <span
                  className="relative inline-flex h-[5px] w-[5px] rounded-full"
                  style={{ background: '#d4a84b' }}
                />
              </span>
              Acesso liberado
            </span>
          </div>

          {/* Headline com gradient text */}
          <h1
            className="mb-2 text-center text-[22px] sm:text-[24px] font-bold leading-tight tracking-tight"
            style={{
              background: 'linear-gradient(140deg, #f0c96e 0%, #d4a84b 50%, #b8832a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Seu dinheiro finalmente<br />vai ter destino.
          </h1>

          {/* Sub-headline */}
          <p
            className="mb-3 text-center text-[12px] sm:text-[13px] leading-snug"
            style={{ color: 'rgba(255,255,255,0.48)' }}
          >
            Em{' '}
            <strong style={{ color: 'rgba(255,255,255,0.78)' }}>{dias} dias de acesso gratuito</strong>, você sai
            do modo <em>"para onde foi meu dinheiro?"</em> e passa a ter um painel claro de entradas, saídas e
            metas.
          </p>

          {/* Separador sutil */}
          <div
            className="mb-3 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }}
          />

          {/* Micro-benefícios */}
          <ul className="mb-3 space-y-2">
            {[
              'Lançamentos em segundos — até pelo WhatsApp',
              'Categorias automáticas que realmente fazem sentido',
              'Resumo financeiro do mês, sem planilha nenhuma',
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-[13px]"
                style={{ color: 'rgba(255,255,255,0.62)' }}
              >
                <span
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: 'rgba(212,168,75,0.12)',
                    border: '1px solid rgba(212,168,75,0.24)',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path
                      d="M2 5.5l2 2 4-4"
                      stroke="#d4a84b"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          {/* Trial end date */}
          {trialEndStr && (
            <div
              className="mb-3 flex items-center gap-3 rounded-[14px] px-4 py-2.5"
              style={{
                background: 'rgba(212,168,75,0.06)',
                border: '1px solid rgba(212,168,75,0.16)',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                className="shrink-0"
                style={{ color: '#d4a84b', opacity: 0.8 }}
              >
                <rect x="1.5" y="3" width="13" height="11.5" rx="2.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5 1.5v3M11 1.5v3M1.5 7h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.50)' }}>
                Acesso gratuito até{' '}
                <strong style={{ color: 'rgba(255,255,255,0.82)' }}>{trialEndStr}</strong>
              </p>
            </div>
          )}

          {/* Erro */}
          {err && (
            <p className="mb-4 text-center text-[13px]" style={{ color: '#f87171' }}>
              {err}
            </p>
          )}

          {/* CTAs */}
          <div className="space-y-2">
            <Link
              to="/pagamento"
              className="flex w-full items-center justify-center rounded-[14px] py-3.5 text-[13px] sm:text-sm font-semibold no-underline transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #d4a84b 0%, #c49535 100%)',
                color: '#1a1200',
                boxShadow: '0 4px 24px rgba(212,168,75,0.28), 0 1px 0 rgba(255,255,255,0.18) inset',
              }}
            >
              Garantir minha assinatura
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={handleEntrarNoApp}
              className="w-full rounded-[14px] py-3.5 text-[13px] sm:text-sm font-medium transition-all duration-200 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
              style={{
                background: 'transparent',
                color: 'rgba(255,255,255,0.48)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              {busy ? 'Entrando…' : 'Explorar o app primeiro'}
            </button>
          </div>

          {/* Trust reducer */}
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden style={{ color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>
              <rect x="1.5" y="4.5" width="8" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1" />
              <path d="M3.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.24)' }}>
              Sem fidelidade · Cancele quando quiser · Asaas (cartão, Pix)
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import './bem-vindo-assinatura.css'

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
  'Vê pra onde vai cada centavo — e para de se assustar no fim do mês',
  'Descobre os gastos invisíveis que drenam centenas todo mês',
  'Fala com o seu dinheiro pelo WhatsApp, a qualquer hora',
]

/** Permite abrir a tela para revisão (`?preview=1`) sem ser redirecionado. */
function isPreviewMode() {
  try {
    return new URLSearchParams(window.location.search).get('preview') === '1'
  } catch {
    return false
  }
}

export default function BemVindoAssinatura() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const previewMode = isPreviewMode()
  const user = readUser()
  const primeiroNome = (user?.nome || '').trim().split(/\s+/)[0] || ''
  const dias = Number(user?.trial_dias_gratis) || 7
  const trialEnd = user?.trial_ends_at ? new Date(user.trial_ends_at) : null
  const trialEndStr =
    trialEnd && !Number.isNaN(trialEnd.getTime())
      ? trialEnd.toLocaleString('pt-BR', { dateStyle: 'long' })
      : null

  useEffect(() => {
    if (previewMode) return
    const u = readUser()
    if (!u?.id) {
      navigate('/login', { replace: true })
      return
    }
    if (u.mostrar_bem_vindo_assinatura === false) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, previewMode])

  useEffect(() => {
    if (previewMode) return undefined
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
  }, [navigate, previewMode])

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
    <div className="bemvindo-screen relative flex min-h-[100dvh] min-h-[100svh] w-full items-center justify-center overflow-y-auto px-4 py-3">
      <div className="relative w-full max-w-[400px]">
        <div className="bemvindo-topline absolute -top-px left-10 right-10 h-px" aria-hidden />

        <div className="bemvindo-card relative rounded-[22px] px-5 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          {/* Topo: logo + badge */}
          <div className="mb-3 text-center">
            <img
              src={BRAND_ASSETS.loginSeverinoLight}
              alt="Severino"
              className="mx-auto mb-2 h-auto w-full max-w-[108px] object-contain"
            />
            <span className="bemvindo-badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[9.5px] font-semibold uppercase tracking-widest">
              <span className="relative flex h-[5px] w-[5px] shrink-0">
                <span className="bemvindo-badge-ping absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                <span className="bemvindo-badge-dot relative inline-flex h-[5px] w-[5px] rounded-full" />
              </span>
              Conta criada · acesso completo liberado
            </span>
          </div>

          {/* Headline */}
          <div className="mb-3 text-center">
            <h1 className="bemvindo-title mb-1.5 text-[18px] font-bold leading-[1.18] tracking-tight sm:text-[19px]">
              {primeiroNome ? `${primeiroNome}, em 2 minutos por dia você assume o ` : 'Em 2 minutos por dia você assume o '}
              <span className="bemvindo-title-accent">controle total</span> do seu dinheiro.
            </h1>
            <p className="bemvindo-subtitle text-[11.5px] leading-snug sm:text-[12px]">
              Lança o gasto pelo WhatsApp, o Severino organiza tudo, te avisa antes da conta vencer e mostra pra onde cada real está indo.{' '}
              <span className="bemvindo-subtitle-accent">Sem planilha, sem esforço.</span>
            </p>
          </div>

          {/* Bullets */}
          <p className="bemvindo-bullets-label mb-1.5 text-[9.5px] font-semibold uppercase tracking-widest">
            O que você desbloqueia agora
          </p>
          <ul className="mb-2.5 space-y-1">
            {TRANSFORMACOES.map((item) => (
              <li key={item} className="bemvindo-bullet flex items-center gap-2.5 text-[12px] leading-snug">
                <span className="bemvindo-bullet-icon flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full">
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M2 5.5l2 2 4-4" stroke="#b8832a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          {/* Trial */}
          <div className="bemvindo-trial mb-3 rounded-[12px] px-3.5 py-2">
            <p className="bemvindo-trial-title text-[12px] font-semibold">
              {dias} dias com tudo liberado. Você não paga nada agora.
            </p>
            <p className="bemvindo-trial-text text-[11px] leading-snug">
              Testa o Severino inteiro. Não curtiu? Cancela em 1 clique, sem pegadinha — você só paga se decidir continuar.
              {trialEndStr && (
                <> Acesso até <strong className="bemvindo-trial-strong">{trialEndStr}</strong>.</>
              )}
            </p>
          </div>

          {/* Erro */}
          {err && (
            <p className="bemvindo-error mb-2.5 text-center text-[12px]">{err}</p>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-1">
            <Link
              to="/pagamento"
              className="bemvindo-cta flex w-full items-center justify-center gap-2 rounded-[13px] py-2.5 text-[13px] font-semibold no-underline transition-all duration-200 hover:brightness-[1.04] active:scale-[0.98] sm:text-[13.5px]"
            >
              Quero o controle completo agora
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none" aria-hidden>
                <path d="M2.5 6.5h8M6.5 3l3.5 3.5L6.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <p className="bemvindo-cta-hint text-center text-[10px]">
              Comece hoje · Cancele quando quiser · Sem multa
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={handleEntrarNoApp}
              className="bemvindo-skip w-full py-1 text-center text-[12px] font-medium transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Entrando…' : 'Agora não, quero só explorar'}
            </button>

            <a
              href="https://wa.me/5554996994482?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20a%20minha%20conta%20do%20Severino."
              target="_blank"
              rel="noopener noreferrer"
              className="bemvindo-support mt-0.5 flex w-full items-center justify-center gap-2 rounded-[13px] py-2 text-[12px] font-semibold no-underline transition-colors duration-200 active:scale-[0.98]"
            >
              <svg width="15" height="15" viewBox="0 0 448 512" fill="currentColor" aria-hidden className="bemvindo-support-icon">
                <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l140.9-37.4c32.4 17.7 68.9 27 106.1 27h.1c122.4 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.1c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.7-32.8-16.2-37.9-18-5.1-1.9-8.8-2.7-12.5 2.7-3.7 5.5-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.7-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
              </svg>
              Falar com suporte
            </a>
          </div>

          {/* Trust footer */}
          <div className="mt-2.5 flex items-center justify-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none" aria-hidden className="bemvindo-trust-icon">
              <rect x="1.5" y="4.5" width="8" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1" />
              <path d="M3.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <p className="bemvindo-trust-text text-[10px]">
              Pagamento 100% seguro via Asaas · Cartão ou Pix
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

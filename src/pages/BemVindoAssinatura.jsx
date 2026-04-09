import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { apiUrl } from '../lib/apiUrl'

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
          headers: { 'x-user-id': String(u.id).trim() },
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
        headers: { 'x-user-id': u.id },
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
    <div className="min-h-[100dvh] min-h-[100svh] flex items-center justify-center p-4 sm:p-6 relative">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(212,168,75,0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(99,102,241,0.06), transparent)',
        }}
      />
      <div
        className="relative w-full max-w-lg rounded-2xl border p-6 sm:p-8 shadow-xl"
        style={{
          borderColor: 'rgba(148,163,184,0.25)',
          background: 'var(--bg-secondary, rgba(15,23,42,0.85))',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex justify-center mb-6">
          <img src={BRAND_ASSETS.logo} alt="" className="h-12 w-auto object-contain" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
          Bem-vindo ao Horizonte Financeiro
        </h1>
        <p className="text-center text-sm sm:text-base mb-6" style={{ color: 'var(--text-secondary)' }}>
          Você está em um <strong style={{ color: 'var(--text-primary)' }}>teste gratuito de {dias} dias</strong> com acesso
          completo ao aplicativo. Depois desse período, para continuar usando é necessário concluir a assinatura pelo{' '}
          <strong style={{ color: 'var(--text-primary)' }}>Mercado Pago</strong> (checkout seguro com cartão, Pix e outros
          meios).
        </p>

        {trialEndStr && (
          <p
            className="text-center text-sm mb-6 px-3 py-2 rounded-xl"
            style={{
              background: 'rgba(99,102,241,0.1)',
              color: 'var(--text-secondary)',
            }}
          >
            Seu teste vai até <strong style={{ color: 'var(--text-primary)' }}>{trialEndStr}</strong>.
          </p>
        )}

        {err && (
          <p className="text-sm text-center mb-4" style={{ color: 'var(--danger, #ef4444)' }}>
            {err}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/pagamento"
            className="btn-primary text-center no-underline"
            style={{ padding: '12px 20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            Assinar com Mercado Pago
          </Link>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '12px 20px' }}
            disabled={busy}
            onClick={handleEntrarNoApp}
          >
            {busy ? 'Salvando…' : 'Começar a usar o app'}
          </button>
        </div>

        <p className="text-xs text-center mt-6" style={{ color: 'var(--text-secondary)' }}>
          Você pode assinar agora ou aproveitar o teste e pagar antes do fim dos {dias} dias.
        </p>
      </div>
    </div>
  )
}

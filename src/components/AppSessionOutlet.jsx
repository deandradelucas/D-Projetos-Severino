import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { ensureSessionAccessToken } from '../lib/bootstrapHorizonteSession'
import AuthenticatedNavPrefetch from './AuthenticatedNavPrefetch'
import MobileBottomNav from './MobileBottomNav'

function readUser() {
  try {
    const raw = localStorage.getItem('horizonte_user')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Rotas que exigem sessão. Com requireAppAccess, atualiza assinatura na API e bloqueia sem trial/pagamento.
 * Após login (location.state.freshLogin), o JSON do POST /login já traz assinatura — não bloqueia a UI nesse round-trip.
 */
export default function AppSessionOutlet({ requireAppAccess = false }) {
  const location = useLocation()
  const [state, setState] = useState(() => {
    const user = readUser()
    const pularEsperaAssinatura =
      requireAppAccess && location.state?.freshLogin === true && Boolean(user?.id)
    return {
      bootstrapping: Boolean(user?.id),
      loading: requireAppAccess && !pularEsperaAssinatura,
      user,
    }
  })

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const u = readUser()
      if (!u?.id) {
        if (!cancelled) setState({ bootstrapping: false, loading: false, user: null })
        return
      }

      const boot = await ensureSessionAccessToken()
      if (cancelled || boot === 'logout') return

      if (!cancelled) {
        setState((prev) => ({ ...prev, bootstrapping: false }))
      }

      if (!requireAppAccess) {
        if (!cancelled) setState({ bootstrapping: false, loading: false, user: u })
        return
      }

      /* Login recém-feito: sincroniza assinatura em background (mesmos dados já estão no localStorage) */
      if (location.state?.freshLogin === true) {
        const controller = new AbortController()
        const timeoutMs = 12000
        const tid = window.setTimeout(() => controller.abort(), timeoutMs)
        try {
          const res = await apiFetch(apiUrl('/api/assinatura/status'), {
            cache: 'no-store',
            signal: controller.signal,
          })
          if (res.ok) {
            const assinatura = await res.json()
            const merged = { ...readUser(), ...assinatura }
            if (merged.acesso_app_liberado === undefined) merged.acesso_app_liberado = true
            localStorage.setItem('horizonte_user', JSON.stringify(merged))
            window.dispatchEvent(new Event('horizonte-session-refresh'))
            if (!cancelled) setState({ bootstrapping: false, loading: false, user: merged })
            return
          }
        } catch {
          /* rede ou abort — mantém usuário já gravado no login */
        } finally {
          window.clearTimeout(tid)
          controller.abort()
        }
        if (!cancelled) setState({ bootstrapping: false, loading: false, user: u })
        return
      }

      const controller = new AbortController()
      const timeoutMs = 12000
      const tid = window.setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await apiFetch(apiUrl('/api/assinatura/status'), {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (res.ok) {
          const assinatura = await res.json()
          const merged = { ...u, ...assinatura }
          if (merged.acesso_app_liberado === undefined) merged.acesso_app_liberado = true
          localStorage.setItem('horizonte_user', JSON.stringify(merged))
          window.dispatchEvent(new Event('horizonte-session-refresh'))
          if (!cancelled) setState({ bootstrapping: false, loading: false, user: merged })
          return
        }
      } catch {
        /* rede, abort ou erro — mantém sessão local */
      } finally {
        window.clearTimeout(tid)
        controller.abort()
      }
      if (!cancelled) setState({ bootstrapping: false, loading: false, user: u })
    })()

    return () => {
      cancelled = true
    }
  }, [requireAppAccess, location.state?.freshLogin, location.pathname])

  if (state.bootstrapping || state.loading) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary, #64748b)',
          fontSize: '14px',
          boxSizing: 'border-box',
        }}
      >
        Carregando…
      </div>
    )
  }

  if (!state.user?.id) {
    return <Navigate to="/login" replace />
  }

  if (requireAppAccess && state.user.acesso_app_liberado === false) {
    return <Navigate to="/trial-expirado" replace />
  }

  /* Pagamento fica fora de requireAppAccess (trial/checkout), mas usa o menu inferior no mobile */
  const showMobileBottomNav =
    Boolean(state.user?.id) &&
    (requireAppAccess || location.pathname === '/pagamento')

  return (
    <>
      {requireAppAccess ? <AuthenticatedNavPrefetch /> : null}
      <Outlet />
      {showMobileBottomNav ? <MobileBottomNav /> : null}
    </>
  )
}

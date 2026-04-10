import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'
import AuthenticatedNavPrefetch from './AuthenticatedNavPrefetch'

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
      loading: requireAppAccess && !pularEsperaAssinatura,
      user,
    }
  })

  useEffect(() => {
    if (!requireAppAccess) return

    let cancelled = false

    const u = readUser()
    if (!u?.id) {
      if (!cancelled) setState({ loading: false, user: null })
      return
    }

    /* Login recém-feito: sincroniza assinatura em background (mesmos dados já estão no localStorage) */
    if (location.state?.freshLogin === true) {
      const controller = new AbortController()
      const timeoutMs = 12000
      const tid = window.setTimeout(() => controller.abort(), timeoutMs)
      ;(async () => {
        try {
          const res = await fetch(apiUrl('/api/assinatura/status'), {
            headers: { 'x-user-id': String(u.id).trim() },
            cache: 'no-store',
            signal: controller.signal,
          })
          window.clearTimeout(tid)
          if (res.ok) {
            const assinatura = await res.json()
            const merged = { ...readUser(), ...assinatura }
            if (merged.acesso_app_liberado === undefined) merged.acesso_app_liberado = true
            localStorage.setItem('horizonte_user', JSON.stringify(merged))
            window.dispatchEvent(new Event('horizonte-session-refresh'))
            if (!cancelled) setState({ loading: false, user: merged })
          }
        } catch {
          /* rede ou abort — mantém usuário já gravado no login */
        } finally {
          window.clearTimeout(tid)
        }
      })()

      return () => {
        cancelled = true
      }
    }

    const controller = new AbortController()
    const timeoutMs = 12000
    const tid = window.setTimeout(() => controller.abort(), timeoutMs)
    ;(async () => {
      try {
        const res = await fetch(apiUrl('/api/assinatura/status'), {
          headers: { 'x-user-id': String(u.id).trim() },
          cache: 'no-store',
          signal: controller.signal,
        })
        window.clearTimeout(tid)
        if (res.ok) {
          const assinatura = await res.json()
          const merged = { ...u, ...assinatura }
          if (merged.acesso_app_liberado === undefined) merged.acesso_app_liberado = true
          localStorage.setItem('horizonte_user', JSON.stringify(merged))
          window.dispatchEvent(new Event('horizonte-session-refresh'))
          if (!cancelled) setState({ loading: false, user: merged })
          return
        }
      } catch {
        /* rede, abort ou erro — mantém sessão local */
      } finally {
        window.clearTimeout(tid)
      }
      if (!cancelled) setState({ loading: false, user: u })
    })()

    return () => {
      cancelled = true
    }
  }, [requireAppAccess, location.state?.freshLogin])

  if (state.loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary, #64748b)',
          fontSize: '14px',
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
    return <Navigate to="/pagamento?expirado=1" replace />
  }

  return (
    <>
      {requireAppAccess ? <AuthenticatedNavPrefetch /> : null}
      <Outlet />
    </>
  )
}

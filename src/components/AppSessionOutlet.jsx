import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'

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
 */
export default function AppSessionOutlet({ requireAppAccess = false }) {
  const [state, setState] = useState(() => ({
    loading: requireAppAccess,
    user: readUser(),
  }))

  useEffect(() => {
    if (!requireAppAccess) {
      setState({ loading: false, user: readUser() })
      return
    }

    let cancelled = false
    ;(async () => {
      const u = readUser()
      if (!u?.id) {
        if (!cancelled) setState({ loading: false, user: null })
        return
      }
      try {
        const res = await fetch(apiUrl('/api/assinatura/status'), {
          headers: { 'x-user-id': String(u.id).trim() },
          cache: 'no-store',
        })
        if (res.ok) {
          const assinatura = await res.json()
          const merged = { ...u, ...assinatura }
          if (merged.acesso_app_liberado === undefined) merged.acesso_app_liberado = true
          localStorage.setItem('horizonte_user', JSON.stringify(merged))
          if (!cancelled) setState({ loading: false, user: merged })
          return
        }
      } catch {
        /* mantém sessão local */
      }
      if (!cancelled) setState({ loading: false, user: u })
    })()

    return () => {
      cancelled = true
    }
  }, [requireAppAccess])

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

  return <Outlet />
}

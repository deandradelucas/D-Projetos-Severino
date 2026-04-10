import { useEffect, useRef } from 'react'
import { warmAuthenticatedNavChunks } from '../lazyRoutes'

/**
 * Dispara uma vez o pré-carregamento dos chunks do menu (dashboard, transações, relatórios, config).
 * Troca de rota passa a reutilizar JS já em cache (navegação mais rápida).
 */
export default function AuthenticatedNavPrefetch() {
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    warmAuthenticatedNavChunks()
  }, [])
  return null
}

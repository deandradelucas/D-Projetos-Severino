import { createContext, useContext } from 'react'

/** Disparado após `/api/transacoes` atualizar o cache (ex.: lançamento pelo WhatsApp). */
export const TRANSACOES_REVALIDATED_EVENT = 'horizonte-transacoes-revalidated'

export const TransactionCacheContext = createContext(null)

/**
 * Hook para consumir a store de transações.
 * Lança erro descritivo se usado fora do Provider.
 */
export function useTransactionCache() {
  const ctx = useContext(TransactionCacheContext)
  if (!ctx) {
    throw new Error('useTransactionCache deve ser usado dentro de <TransactionCacheProvider>')
  }
  return ctx
}

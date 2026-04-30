import { createContext, useContext } from 'react'

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

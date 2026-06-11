/**
 * Persistência do cache de transações no localStorage (por usuário).
 *
 * No cold start do PWA, pinta a tela instantaneamente com os últimos dados
 * conhecidos enquanto o SWR revalida em background — em vez de skeleton até o
 * fetch completo terminar. Dados do próprio usuário, no próprio dispositivo
 * (mesma sensibilidade da sessão em `horizonte_user`). Segredos NUNCA entram.
 *
 * Teto de 800 linhas: o GET /api/transacoes devolve até 500 (+ parcelas
 * pendentes); 800 cobre a folga sem arriscar a cota do localStorage (~5 MB).
 */
import { createPersistedCache } from './persistedCache'

const cache = createPersistedCache({ prefix: 'horizonte_tx_cache_v1:', maxItems: 800 })

export const readTxCache = cache.read
export const writeTxCache = cache.write
export const clearTxCache = cache.clear

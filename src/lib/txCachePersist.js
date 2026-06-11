/**
 * Persistência do cache de transações no localStorage (por usuário).
 *
 * Objetivo: no cold start do PWA (abrir o app no celular do zero), pintar a tela
 * instantaneamente com os últimos dados conhecidos enquanto o SWR revalida em
 * background — em vez de mostrar skeleton e esperar o fetch completo terminar.
 *
 * Os dados são do próprio usuário, no próprio dispositivo (mesma sensibilidade da
 * sessão já guardada em `horizonte_user`). Segredos NUNCA entram aqui.
 */

const PREFIX = 'horizonte_tx_cache_v1:'
// Teto de linhas guardadas — o GET /api/transacoes devolve até 500 (+ parcelas
// pendentes). 800 cobre a folga sem arriscar a cota do localStorage (~5 MB).
const MAX_ROWS = 800

/** Lê o cache persistido do usuário. Retorna array ou null se ausente/inválido. */
export function readTxCache(usuarioId) {
  const id = String(usuarioId || '').trim()
  if (!id || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(PREFIX + id)
    if (!raw) return null
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : null
  } catch {
    return null
  }
}

/** Grava (com teto) o cache do usuário. Falha de cota/modo privado é silenciosa. */
export function writeTxCache(usuarioId, transacoes) {
  const id = String(usuarioId || '').trim()
  if (!id || typeof localStorage === 'undefined') return
  try {
    const slice = Array.isArray(transacoes) ? transacoes.slice(0, MAX_ROWS) : []
    localStorage.setItem(PREFIX + id, JSON.stringify(slice))
  } catch {
    /* cota cheia / Safari privado: cache em memória continua valendo */
  }
}

/** Remove o cache persistido do usuário (troca de conta / logout). */
export function clearTxCache(usuarioId) {
  const id = String(usuarioId || '').trim()
  if (typeof localStorage === 'undefined') return
  try {
    if (id) localStorage.removeItem(PREFIX + id)
  } catch {
    /* ignore */
  }
}

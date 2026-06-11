/**
 * Persistência do cache de Listas (compras/tarefas) no localStorage, por usuário.
 *
 * Mesmo objetivo do cache de transações: no cold start do PWA, pintar as listas
 * e os itens instantaneamente com o último estado conhecido enquanto revalida em
 * background — em vez de spinner até o GET (com itens embutidos) terminar.
 *
 * Guarda apenas o snapshot do escopo PADRÃO (família/default, sem `?pessoal=1`),
 * para não exibir listas de um escopo no outro. Dados do próprio usuário, no
 * próprio dispositivo. Segredos NUNCA entram aqui.
 */

const PREFIX = 'horizonte_listas_cache_v1:'
const MAX_LISTAS = 60

/** Lê o snapshot persistido das listas do usuário. Array ou null. */
export function readListasCache(usuarioId) {
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

/** Grava (com teto) o snapshot das listas do usuário. Falha de cota é silenciosa. */
export function writeListasCache(usuarioId, listas) {
  const id = String(usuarioId || '').trim()
  if (!id || typeof localStorage === 'undefined') return
  try {
    const slice = Array.isArray(listas) ? listas.slice(0, MAX_LISTAS) : []
    localStorage.setItem(PREFIX + id, JSON.stringify(slice))
  } catch {
    /* cota cheia / Safari privado: segue só com a rede */
  }
}

/** Remove o snapshot persistido das listas do usuário (troca de conta / logout). */
export function clearListasCache(usuarioId) {
  const id = String(usuarioId || '').trim()
  if (typeof localStorage === 'undefined') return
  try {
    if (id) localStorage.removeItem(PREFIX + id)
  } catch {
    /* ignore */
  }
}

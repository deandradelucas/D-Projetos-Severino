/**
 * Factory de cache persistido no localStorage, por usuário — base comum dos
 * caches de cold start (transações, listas, cartões, agenda).
 *
 * Objetivo: pintar a tela instantaneamente com o último estado conhecido no
 * cold start do PWA, revalidando em background. Dados do próprio usuário, no
 * próprio dispositivo. Segredos NUNCA entram aqui.
 *
 * @param {{ prefix: string, maxItems?: number }} opts
 *   prefix   — namespace da chave (ex.: 'horizonte_tx_cache_v1:')
 *   maxItems — se > 0 e o valor for array, guarda no máximo N itens (teto de cota)
 * @returns {{ read: (uid:string)=>any, write: (uid:string, value:any)=>void, clear: (uid:string)=>void }}
 */
export function createPersistedCache({ prefix, maxItems = 0 }) {
  const keyFor = (userId) => prefix + String(userId || '').trim()

  return {
    /** Lê o valor persistido do usuário. Retorna o valor parseado ou null. */
    read(userId) {
      const id = String(userId || '').trim()
      if (!id || typeof localStorage === 'undefined') return null
      try {
        const raw = localStorage.getItem(keyFor(id))
        if (!raw) return null
        return JSON.parse(raw)
      } catch {
        return null
      }
    },

    /** Grava o valor (arrays cortados em maxItems). Falha de cota é silenciosa. */
    write(userId, value) {
      const id = String(userId || '').trim()
      if (!id || typeof localStorage === 'undefined') return
      try {
        const v = maxItems > 0 && Array.isArray(value) ? value.slice(0, maxItems) : value
        localStorage.setItem(keyFor(id), JSON.stringify(v))
      } catch {
        /* cota cheia / Safari privado: segue só com a rede */
      }
    },

    /** Remove o valor persistido do usuário (troca de conta / logout). */
    clear(userId) {
      const id = String(userId || '').trim()
      if (typeof localStorage === 'undefined') return
      try {
        if (id) localStorage.removeItem(keyFor(id))
      } catch {
        /* ignore */
      }
    },
  }
}

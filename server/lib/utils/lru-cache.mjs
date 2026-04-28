/**
 * Implementação simples de cache LRU (Least Recently Used) 
 * para evitar crescimento infinito de memória em processos de longa duração.
 */
export class LRUCache {
  constructor(limit = 1000) {
    this.limit = limit
    this.cache = new Map()
  }

  has(key) {
    return this.cache.has(key)
  }

  get(key) {
    if (!this.cache.has(key)) return undefined
    const val = this.cache.get(key)
    // Move para o final (mais recente)
    this.cache.delete(key)
    this.cache.set(key, val)
    return val
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.limit) {
      // Remove o primeiro (mais antigo)
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  clear() {
    this.cache.clear()
  }
}

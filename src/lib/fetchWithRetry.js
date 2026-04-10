/**
 * fetch com reintentos para redes móveis instáveis e cold start do servidor.
 * Não reintenta respostas 4xx (exceto 408 e 429).
 */
export async function fetchWithRetry(input, init = {}, options = {}) {
  const { retries = 4, baseDelayMs = 350, maxDelayMs = 3500 } = options

  let lastRes
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(input, {
        ...init,
        cache: init?.cache ?? 'no-store',
      })
      lastRes = res
      if (res.ok) return res

      const retryable =
        res.status === 408 ||
        res.status === 429 ||
        (res.status >= 500 && res.status <= 504)
      if (!retryable || attempt === retries - 1) return res
    } catch {
      if (attempt === retries - 1) throw new Error('network')
    }
    const jitter = Math.random() * 150
    const delay = Math.min(baseDelayMs * 2 ** attempt + jitter, maxDelayMs)
    await new Promise((r) => setTimeout(r, delay))
  }
  return lastRes
}

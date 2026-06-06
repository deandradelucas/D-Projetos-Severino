import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Comparação de strings em tempo constante (timing-safe). Hasheia ambos os lados
 * com SHA-256 antes de comparar, garantindo buffers de mesmo tamanho mesmo quando
 * os valores têm comprimentos diferentes. Use para secrets/tokens (cron, webhook).
 */
export function safeEqualStr(a, b) {
  const ha = createHash('sha256').update(String(a ?? '')).digest()
  const hb = createHash('sha256').update(String(b ?? '')).digest()
  return timingSafeEqual(ha, hb)
}

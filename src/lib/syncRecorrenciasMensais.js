import { apiUrl } from './apiUrl'

const SYNC_TIMEOUT_MS = 10_000

/** Gera lançamentos do dia 1 em atraso (servidor; idempotente por mês). */
export async function syncRecorrenciasMensais(userId) {
  if (!userId) return
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
  try {
    await fetch(apiUrl('/api/recorrencias-mensais/sincronizar'), {
      method: 'POST',
      headers: { 'x-user-id': String(userId).trim() },
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch {
    /* offline / timeout */
  } finally {
    clearTimeout(t)
  }
}

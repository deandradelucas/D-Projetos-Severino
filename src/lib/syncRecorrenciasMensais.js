import { apiUrl } from './apiUrl'

/** Gera lançamentos do dia 1 em atraso (servidor; idempotente por mês). */
export async function syncRecorrenciasMensais(userId) {
  if (!userId) return
  try {
    await fetch(apiUrl('/api/recorrencias-mensais/sincronizar'), {
      method: 'POST',
      headers: { 'x-user-id': String(userId).trim() },
      cache: 'no-store',
    })
  } catch {
    /* offline */
  }
}

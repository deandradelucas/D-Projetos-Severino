// @ts-check
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { log } from './logger.mjs'

/** Carência (dias) entre a solicitação de exclusão e o hard-delete definitivo. */
const GRACE_DAYS = Number.parseInt(String(process.env.LGPD_PURGE_GRACE_DAYS || '30').trim(), 10) || 30

/**
 * Purga (hard-delete) as contas cuja exclusão foi solicitada há mais de GRACE_DAYS.
 * Cada conta é apagada atomicamente pela função SQL `lgpd_purge_usuario`
 * (anonimiza pagamentos/auditoria, bloqueia titular com membros).
 * Idempotente e retryável — roda diariamente.
 * @returns {Promise<{ apagadas: number, falhas: number, bloqueadas: number }>}
 */
export async function purgeAccountsForDeletion() {
  const sb = getSupabaseAdmin()
  const cutoffIso = new Date(Date.now() - GRACE_DAYS * 24 * 3600 * 1000).toISOString()

  const { data: pendentes, error } = await sb
    .from('usuarios')
    .select('id, conta_exclusao_solicitada_em')
    .eq('is_active', false)
    .not('conta_exclusao_solicitada_em', 'is', null)
    .lt('conta_exclusao_solicitada_em', cutoffIso)

  if (error) {
    log.error('[lgpd-purge] falha ao listar contas pendentes', error?.message)
    return { apagadas: 0, falhas: 0, bloqueadas: 0 }
  }

  let apagadas = 0
  let falhas = 0
  let bloqueadas = 0

  for (const u of pendentes || []) {
    try {
      const { error: rpcErr } = await sb.rpc('lgpd_purge_usuario', { p_id: u.id })
      if (rpcErr) throw rpcErr
      apagadas++
      log.info('[lgpd-purge] conta apagada definitivamente', { usuario_id: u.id })
    } catch (e) {
      const msg = String(e?.message || e)
      if (msg.includes('titular_com_membros')) {
        bloqueadas++
        log.warn('[lgpd-purge] conta bloqueada (titular com membros)', { usuario_id: u.id })
      } else {
        falhas++
        log.error('[lgpd-purge] falha ao apagar conta', { usuario_id: u.id, msg })
      }
    }
  }

  if ((pendentes || []).length) {
    log.info('[lgpd-purge] ciclo concluído', { apagadas, falhas, bloqueadas, carencia_dias: GRACE_DAYS })
  }
  return { apagadas, falhas, bloqueadas }
}

import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'

/**
 * @param {{
 *   actorUserId?: string | null
 *   action: string
 *   targetUserId?: string | null
 *   targetEmail?: string | null
 *   detail?: Record<string, unknown> | null
 *   clientIp?: string | null
 * }} row
 */
export async function insertAdminAuditLog(row) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.from('admin_audit_log').insert({
      actor_user_id: row.actorUserId || null,
      action: row.action,
      target_user_id: row.targetUserId || null,
      target_email: row.targetEmail ? String(row.targetEmail).trim().toLowerCase() : null,
      detail: row.detail && typeof row.detail === 'object' ? row.detail : null,
      client_ip: row.clientIp ? String(row.clientIp).slice(0, 80) : null,
    })
    if (error) {
      log.error('[admin_audit] insert falhou (tabela existe? migration 13):', error)
    }
  } catch (e) {
    log.error('[admin_audit] insert exceção:', e)
  }
}

export async function listAdminAuditLog(limit = 80) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const lim = Math.min(500, Math.max(1, Number(limit) || 80))
    const { data, error } = await supabaseAdmin
      .from('admin_audit_log')
      .select('id, created_at, actor_user_id, action, target_user_id, target_email, detail, client_ip')
      .order('created_at', { ascending: false })
      .limit(lim)

    if (error) {
      log.error('[admin_audit] list falhou (migration 13 aplicada?):', error)
      return []
    }
    return data || []
  } catch (e) {
    log.error('[admin_audit] list exceção:', e)
    return []
  }
}

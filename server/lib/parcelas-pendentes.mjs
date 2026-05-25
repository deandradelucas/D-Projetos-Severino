import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'

/**
 * Ativa parcelas de parcelamentos cujo vencimento já chegou.
 * Atualiza PENDENTE → EFETIVADA para transações com recorrente_grupo_id
 * onde data_transacao <= agora.
 *
 * Chamado pelo endpoint GET /api/cron/parcelas-pendentes (diariamente).
 */
export async function processarParcelasPendentes() {
  const supabase = getSupabaseAdmin()
  const agora = new Date().toISOString()

  const { data, error } = await supabase
    .from('transacoes')
    .update({ status: 'EFETIVADA' })
    .eq('status', 'PENDENTE')
    .not('recorrente_grupo_id', 'is', null)
    .lte('data_transacao', agora)
    .select('id, descricao, recorrente_index, recorrente_total, usuario_id, valor')

  if (error) throw error

  const atualizadas = data?.length || 0

  if (atualizadas > 0) {
    log.info('[parcelas-pendentes] parcelas ativadas', {
      total: atualizadas,
      ids: data.map((r) => r.id),
    })
  }

  return { atualizadas, parcelas: data ?? [] }
}

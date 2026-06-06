import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { fimDoDiaBrtIso } from './date-brt.mjs'

/**
 * Ativa parcelas de parcelamentos cujo vencimento já chegou.
 * Atualiza PENDENTE → EFETIVADA para transações com recorrente_grupo_id
 * onde data_transacao <= agora.
 *
 * Chamado pelo endpoint GET /api/cron/parcelas-pendentes (diariamente).
 */
export async function processarParcelasPendentes() {
  const supabase = getSupabaseAdmin()
  // Ativa tudo com vencimento <= fim do dia de HOJE em BRT (não UTC: às 21h BRT o
  // UTC já é o dia seguinte, o que ativava parcelas um dia cedo).
  const fimDoDia = fimDoDiaBrtIso()

  const { data, error } = await supabase
    .from('transacoes')
    .update({ status: 'EFETIVADA' })
    .eq('status', 'PENDENTE')
    .not('recorrente_grupo_id', 'is', null)
    .lte('data_transacao', fimDoDia)
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

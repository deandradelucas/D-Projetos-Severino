import { getSupabaseAdmin } from './supabase-admin.mjs'

/**
 * Estado do onboarding de ativação (checklist de primeiros passos).
 * Calculado a partir de contagens — sem tabela nova.
 */
export async function getOnboardingStatus(usuarioId) {
  const supabase = getSupabaseAdmin()

  const countOf = async (table) => {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', usuarioId)
      if (error) return 0
      return count || 0
    } catch {
      return 0
    }
  }

  const [txs, metas, cartoes] = await Promise.all([
    countOf('transacoes'),
    countOf('metas'),
    countOf('cartoes'),
  ])

  const steps = [
    { key: 'conta', label: 'Conta criada', done: true },
    { key: 'gasto', label: 'Registre seu primeiro gasto', done: txs > 0, cta: 'nova-transacao' },
    { key: 'meta', label: 'Crie sua primeira meta', done: metas > 0, cta: '/metas' },
    { key: 'cartao', label: 'Cadastre um cartão de crédito', done: cartoes > 0, cta: '/cartoes' },
  ]

  const feitos = steps.filter((s) => s.done).length
  return { steps, feitos, total: steps.length, completo: feitos >= steps.length }
}

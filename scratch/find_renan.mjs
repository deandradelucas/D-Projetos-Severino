import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function findRenan() {
  loadEnv()
  const supabase = getSupabaseAdmin()

  // Buscar logs recentes com números DIFERENTES de 554799895014 e 4799895014
  const { data: logs } = await supabase
    .from('whatsapp_logs')
    .select('telefone_remetente, mensagem_recebida, status, data_hora')
    .order('data_hora', { ascending: false })
    .limit(20)

  console.log('--- Últimos 20 logs (todos os números) ---')
  const seen = new Set()
  logs.forEach(l => {
    const tel = l.telefone_remetente
    const isNew = !seen.has(tel)
    seen.add(tel)
    console.log(`[${l.data_hora}] De: ${tel}${isNew ? ' ★ NOVO' : ''} | ${l.mensagem_recebida?.substring(0, 40)} | ${l.status}`)
  })
  console.log('\nNúmeros únicos encontrados:', [...seen])
}

findRenan()

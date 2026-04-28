import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function checkRenan() {
  loadEnv()
  const supabase = getSupabaseAdmin()

  // Dados atuais do Renan
  const { data: renan } = await supabase
    .from('usuarios')
    .select('id, email, telefone, nome')
    .eq('email', 'darivarenan@gmail.com')
    .single()

  console.log('Renan no banco:', renan)

  // Últimos logs ignorados (possíveis mensagens do Renan)
  const { data: logs } = await supabase
    .from('whatsapp_logs')
    .select('telefone_remetente, mensagem_recebida, status, data_hora')
    .eq('status', 'IGNORADO')
    .order('data_hora', { ascending: false })
    .limit(10)

  console.log('\nÚltimos logs IGNORADOS:')
  logs.forEach(l => {
    console.log(`[${l.data_hora}] De: ${l.telefone_remetente} | ${l.mensagem_recebida?.substring(0, 40)} | ${l.status}`)
  })
}

checkRenan()

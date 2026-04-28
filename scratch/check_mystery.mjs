import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function checkMysteryPhone() {
  loadEnv()
  const supabase = getSupabaseAdmin()

  const target = '555499818261'
  const { data: logs } = await supabase
    .from('whatsapp_logs')
    .select('*')
    .eq('telefone_remetente', target)
    .order('data_hora', { ascending: false })
    .limit(5)

  console.log(`--- Logs do número ${target} ---`)
  logs.forEach(l => {
    console.log(`[${l.data_hora}] Msg: ${l.mensagem_recebida} | Status: ${l.status}`)
  })
}

checkMysteryPhone()

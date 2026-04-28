import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function listAllSenders() {
  loadEnv()
  const supabase = getSupabaseAdmin()

  const { data: logs, error } = await supabase
    .from('whatsapp_logs')
    .select('telefone_remetente')

  if (error) {
    console.error('Erro:', error.message)
    return
  }

  const senders = new Set(logs.map(l => l.telefone_remetente))
  console.log('--- Todos os números que já enviaram mensagem ---')
  senders.forEach(s => console.log(s))
  console.log('------------------------------------------------')
}

listAllSenders()

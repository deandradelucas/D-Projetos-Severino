import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function findSpecificPhone() {
  loadEnv()
  const supabase = getSupabaseAdmin()

  const target = '54999684312'
  console.log(`Buscando logs para o número: ${target}...`)
  
  const { data: logs, error } = await supabase
    .from('whatsapp_logs')
    .select('*')
    .or(`telefone_remetente.ilike.%${target}%,telefone_remetente.ilike.%54999684312%`)
    .order('data_hora', { ascending: false })

  if (error) {
    console.error('Erro:', error.message)
    return
  }

  if (logs.length === 0) {
    console.log('Nenhum log encontrado para este número.')
  } else {
    console.log(`Encontrados ${logs.length} logs:`)
    logs.forEach(l => {
      console.log(`[${l.data_hora}] Msg: ${l.mensagem_recebida} | Status: ${l.status}`)
    })
  }
}

findSpecificPhone()

import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function checkWhatsappLogs() {
  loadEnv()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('whatsapp_logs')
    .select('*, usuarios(email, nome)')
    .order('data_hora', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Erro:', error.message)
    return
  }

  console.log('--- Logs do WhatsApp ---')
  data.forEach(log => {
    console.log(`[${log.data_hora}] De: ${log.telefone_remetente} | Usuário: ${log.usuarios?.email || 'Nenhum'} | Msg: ${log.mensagem_recebida?.substring(0, 30)} | Status: ${log.status}`)
  })
  console.log('------------------------')
}

checkWhatsappLogs()

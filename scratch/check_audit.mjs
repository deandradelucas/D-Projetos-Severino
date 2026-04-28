import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function checkAuditLog() {
  loadEnv()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .eq('target_email', 'lukas.andrd@gmail.com')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Erro:', error.message)
    return
  }

  console.log('--- Auditoria para lukas.andrd@gmail.com ---')
  data.forEach(log => {
    console.log(`[${log.created_at}] Ação: ${log.action} | Detalhes: ${JSON.stringify(log.detail)}`)
  })
  console.log('--------------------------------------------')
}

checkAuditLog()

import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function searchUser() {
  loadEnv()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('usuarios')
    .select('email, telefone, nome')
    .or('telefone.ilike.%4799895014%,telefone.ilike.%554799895014%,telefone.ilike.%479895014%')

  if (error) {
    console.error('Erro:', error.message)
    return
  }

  console.log('--- Usuários Encontrados ---')
  data.forEach(u => {
    console.log(`Nome: ${u.nome} | Email: ${u.email} | Telefone: ${u.telefone}`)
  })
  console.log('----------------------------')
}

searchUser()

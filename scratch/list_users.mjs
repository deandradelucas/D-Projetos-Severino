import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function listAllUsers() {
  loadEnv()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('usuarios')
    .select('email, telefone, nome')
    .order('nome')

  if (error) {
    console.error('Erro:', error.message)
    return
  }

  console.log('--- Lista de Todos os Usuários ---')
  data.forEach(u => {
    console.log(`Nome: ${u.nome.padEnd(20)} | Email: ${u.email.padEnd(30)} | Telefone: ${u.telefone}`)
  })
  console.log('---------------------------------')
}

listAllUsers()

import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function checkUserPhone() {
  loadEnv()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('usuarios')
    .select('email, telefone, nome')
    .eq('email', 'lukas.andrd@gmail.com')
    .single()

  if (error) {
    console.error('Erro ao buscar usuário:', error.message)
    return
  }

  console.log('--- Dados do Usuário ---')
  console.log('Nome:', data.nome)
  console.log('Email:', data.email)
  console.log('Telefone:', data.telefone)
  console.log('------------------------')
}

checkUserPhone()

import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function resetAndClean() {
  loadEnv()
  const supabase = getSupabaseAdmin()

  console.log('Resetando telefones conforme solicitado...')

  // Lucas
  await supabase
    .from('usuarios')
    .update({ telefone: '54996994482' })
    .eq('email', 'lukas.andrd@gmail.com')

  // Renan
  await supabase
    .from('usuarios')
    .update({ telefone: '54999684312' })
    .eq('email', 'darivarenan@gmail.com')

  console.log('✅ Telefones resetados para DDD 54.')
}

resetAndClean()

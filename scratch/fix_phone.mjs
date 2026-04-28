import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function fixPhone() {
  loadEnv()
  const supabase = getSupabaseAdmin()

  // Verificar estado atual
  const { data: before } = await supabase
    .from('usuarios')
    .select('id, email, telefone, nome')
    .eq('email', 'lukas.andrd@gmail.com')
    .single()

  console.log('ANTES:', before)

  // Atualizar para o número que está enviando mensagens
  const { data: after, error } = await supabase
    .from('usuarios')
    .update({ telefone: '4799895014' })
    .eq('email', 'lukas.andrd@gmail.com')
    .select('id, email, telefone, nome')
    .single()

  if (error) {
    console.error('ERRO:', error.message)
    return
  }

  console.log('DEPOIS:', after)
  console.log('✅ Telefone atualizado com sucesso!')
}

fixPhone()

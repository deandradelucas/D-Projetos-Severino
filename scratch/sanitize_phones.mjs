import { getSupabaseAdmin } from '../server/lib/supabase-admin.mjs'
import { loadEnv } from '../server/lib/load-env.mjs'

async function sanitizeAllPhones() {
  loadEnv()
  const supabase = getSupabaseAdmin()

  console.log('Buscando usuários para sanitização...')
  const { data: users, error } = await supabase
    .from('usuarios')
    .select('id, telefone, email')
    .not('telefone', 'is', null)

  if (error) {
    console.error('Erro ao buscar usuários:', error.message)
    return
  }

  let count = 0
  for (const user of users) {
    const clean = String(user.telefone).replace(/\D/g, '')
    if (clean !== user.telefone) {
      console.log(`Limpando [${user.email}]: ${user.telefone} -> ${clean}`)
      const { error: upErr } = await supabase
        .from('usuarios')
        .update({ telefone: clean })
        .eq('id', user.id)
      
      if (upErr) {
        console.error(`Erro ao atualizar ${user.email}:`, upErr.message)
      } else {
        count++
      }
    }
  }

  console.log(`\n✅ Sanitização concluída! ${count} usuários atualizados.`)
}

sanitizeAllPhones()

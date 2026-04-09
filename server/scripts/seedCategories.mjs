import { createClient } from '@supabase/supabase-js'
import { log } from '../lib/logger.mjs'
import { DEFAULT_CATEGORIES } from '../lib/transacoes.mjs'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function seedCategoriesForUser(usuario_id) {
  log.info(`Starting seed for user: ${usuario_id}`)
  
  for (const cat of DEFAULT_CATEGORIES) {
    log.info(`- Insert category: ${cat.nome}`)
    const { data: categoriaData, error: errCat } = await supabase
      .from('categorias')
      .insert({
        usuario_id,
        nome: cat.nome,
        tipo: cat.tipo,
        cor: cat.cor
      })
      .select('id')
      .single()

    if (errCat) {
      log.error(`ERROR on insert category ${cat.nome}:`, errCat.message)
      continue
    }

    const categoryId = categoriaData.id
    const subsToInsert = cat.subcategorias.map(subName => ({
      categoria_id: categoryId,
      nome: subName
    }))

    const { error: errSubs } = await supabase
      .from('subcategorias')
      .insert(subsToInsert)

    if (errSubs) {
      log.error(`ERROR on insert subcategories for ${cat.nome}:`, errSubs.message)
    }
  }

  log.info('Seed completed successfully.')
}

async function run() {
  // Pegar todos os usuários existentes e popular (já que não foi feito no signup)
  const { data: users, error } = await supabase.from('usuarios').select('id')
  if (error) {
    log.error('Falha ao obter usuarios:', error)
    return
  }

  // Se nao existir usuarios na tabela, nao tem em quem inserir
  if (!users || users.length === 0) {
    log.info('Nenhum usuario encontrado na tabela public.usuarios')
    return
  }

  // Deleta as categorias anteriores para recriar (isso apagará as transações ligadas que estejam ON DELETE CASCADE/SET NULL)
  // Avisarei o usuario se ele se importa, no caso apenas damos seed
  for (const user of users) {
    log.info(`Deletando antigas para ${user.id}`)
    await supabase.from('categorias').delete().eq('usuario_id', user.id)
    await seedCategoriesForUser(user.id)
  }
  
  process.exit(0)
}

run()

import { getSupabaseAdmin } from './supabase-admin.mjs'

export async function getCategorias(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: categorias, error: catError } = await supabaseAdmin
    .from('categorias')
    .select('id, nome, tipo, cor')
    .eq('usuario_id', usuarioId)

  if (catError) throw catError

  if (!categorias || categorias.length === 0) return []

  const categoriaIds = categorias.map(c => c.id)
  const { data: subcategorias, error: subError } = await supabaseAdmin
    .from('subcategorias')
    .select('id, categoria_id, nome')
    .in('categoria_id', categoriaIds)

  if (subError) throw subError

  // agrupar subcategorias por categoria
  return categorias.map(c => {
    return {
      ...c,
      subcategorias: subcategorias.filter(sub => sub.categoria_id === c.id) || []
    }
  })
}

export async function inserirTransacao({ usuario_id, conta_id, categoria_id, subcategoria_id, tipo, valor, descricao, data_transacao, status }) {
  const supabaseAdmin = getSupabaseAdmin()
  const valNum = parseFloat(valor)
  
  if (isNaN(valNum) || valNum <= 0) {
    throw new Error('Valor inválido.')
  }

  const payload = {
    usuario_id,
    tipo,
    valor: valNum,
    descricao,
    data_transacao,
    status: status || 'EFETIVADA'
  }

  if (conta_id) payload.conta_id = conta_id
  if (categoria_id) payload.categoria_id = categoria_id
  if (subcategoria_id) payload.subcategoria_id = subcategoria_id

  const { data, error } = await supabaseAdmin
    .from('transacoes')
    .insert([payload])
    .select()

  if (error) throw error

  return data[0]
}

export async function getTransacoes(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('transacoes')
    .select(`
      id, tipo, valor, descricao, data_transacao, status,
      categorias(nome, cor),
      subcategorias(nome)
    `)
    .eq('usuario_id', usuarioId)
    .order('data_transacao', { ascending: false })
    .limit(50)

  if (error) throw error

  return data
}

import { getSupabaseAdmin } from './supabase-admin.mjs'
import { isMissingColumnError } from './assinatura-db.mjs'

const LIST_SELECT_COLS = 'id, usuario_id, nome, categoria_financeira, arquivada_em, criada_em'
const ITEM_BASE_COLS = 'id, lista_id, nome, quantidade, unidade, preco_estimado, categoria_item, checked, checked_em, criado_em'

// Coluna `unidades` foi adicionada via migration 50_shopping_list_items_unidades.sql.
// Mantemos fallback gracioso caso o schema ainda não tenha sido migrado: a primeira
// chamada que falhar com 42703 desliga o flag e reusa o select sem `unidades`.
let hasUnidadesColumn = true
const itemSelectCols = () => (hasUnidadesColumn ? `${ITEM_BASE_COLS}, unidades` : ITEM_BASE_COLS)
const listaWithItensSelect = () =>
  `${LIST_SELECT_COLS}, itens:shopping_list_items(${itemSelectCols()})`

function stripUnidadesIfMissing(payload) {
  if (hasUnidadesColumn) return payload
  if (payload && typeof payload === 'object' && 'unidades' in payload) {
    const { unidades: _omit, ...rest } = payload
    return rest
  }
  return payload
}

/**
 * Executa um builder do Supabase. Se ele falhar com erro de coluna `unidades`
 * inexistente, marca a flag e tenta de novo (o caller refaz o builder sem
 * referenciar a coluna).
 * @template T
 * @param {() => Promise<{ data: T, error: any }>} run
 * @returns {Promise<{ data: T, error: any }>}
 */
async function runWithUnidadesFallback(run) {
  const res = await run()
  if (res.error && hasUnidadesColumn && isMissingColumnError(res.error, 'unidades')) {
    hasUnidadesColumn = false
    return await run()
  }
  return res
}

/**
 * @param {string} usuarioId
 * @returns {Promise<Array>}
 */
export async function listarListasUsuario(usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_lists')
      .select(listaWithItensSelect())
      .eq('usuario_id', usuarioId)
      .is('arquivada_em', null)
      .order('criada_em', { ascending: false })
  )

  if (error) throw new Error(error.message || 'Erro ao listar listas.')
  return data || []
}

/**
 * @param {string} usuarioId
 * @param {{ nome: string, categoria_financeira?: string }} campos
 * @returns {Promise<object>}
 */
export async function criarLista(usuarioId, { nome, categoria_financeira }) {
  const nomeTrimmed = String(nome || '').trim()
  if (!nomeTrimmed || nomeTrimmed.length > 100) {
    throw new Error('Nome da lista inválido (1–100 caracteres).')
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_lists')
      .insert({
        usuario_id: usuarioId,
        nome: nomeTrimmed,
        categoria_financeira: String(categoria_financeira || 'Alimentação').trim(),
      })
      .select(listaWithItensSelect())
      .maybeSingle()
  )

  if (error) throw new Error(error.message || 'Erro ao criar lista.')
  return data
}

/**
 * @param {string} id
 * @param {string} usuarioId
 * @param {{ nome?: string, categoria_financeira?: string }} campos
 * @returns {Promise<object>}
 */
export async function atualizarLista(id, usuarioId, campos) {
  const update = {}

  if (campos.nome !== undefined) {
    const nomeTrimmed = String(campos.nome).trim()
    if (!nomeTrimmed || nomeTrimmed.length > 100) {
      throw new Error('Nome da lista inválido (1–100 caracteres).')
    }
    update.nome = nomeTrimmed
  }

  if (campos.categoria_financeira !== undefined) {
    update.categoria_financeira = String(campos.categoria_financeira).trim()
  }

  if (Object.keys(update).length === 0) {
    throw new Error('Nenhum campo para atualizar.')
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_lists')
      .update(update)
      .eq('id', id)
      .eq('usuario_id', usuarioId)
      .is('arquivada_em', null)
      .select(listaWithItensSelect())
      .maybeSingle()
  )

  if (error) throw new Error(error.message || 'Erro ao atualizar lista.')
  if (!data) throw new Error('Lista não encontrada.')
  return data
}

/**
 * @param {string} id
 * @param {string} usuarioId
 * @returns {Promise<void>}
 */
export async function arquivarLista(id, usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('shopping_lists')
    .update({ arquivada_em: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .is('arquivada_em', null)
    .select('id')

  if (error) throw new Error(error.message || 'Erro ao arquivar lista.')
  if (!data?.length) throw new Error('Lista não encontrada.')
}

/**
 * Exclui permanentemente uma lista e todos os seus itens.
 * @param {string} id
 * @param {string} usuarioId
 * @returns {Promise<void>}
 */
export async function excluirLista(id, usuarioId) {
  const supabase = getSupabaseAdmin()
  // Verificar ownership antes de deletar
  const { data: lista, error: findErr } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (findErr) throw new Error(findErr.message || 'Erro ao localizar lista.')
  if (!lista) throw new Error('Lista não encontrada.')

  // Deletar itens primeiro (FK)
  const { error: itemErr } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('lista_id', id)
  if (itemErr) throw new Error(itemErr.message || 'Erro ao remover itens da lista.')

  // Deletar lista
  const { error } = await supabase
    .from('shopping_lists')
    .delete()
    .eq('id', id)
    .eq('usuario_id', usuarioId)
  if (error) throw new Error(error.message || 'Erro ao excluir lista.')
}

/**
 * @param {string} listaId
 * @param {string} usuarioId
 * @returns {Promise<Array>}
 */
export async function listarItensLista(listaId, usuarioId) {
  const supabase = getSupabaseAdmin()

  // Verificar ownership
  const { data: lista } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', listaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!lista) throw new Error('Lista não encontrada.')

  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_list_items')
      .select(itemSelectCols())
      .eq('lista_id', listaId)
      .order('criado_em', { ascending: true })
  )

  if (error) throw new Error(error.message || 'Erro ao listar itens.')
  return data || []
}

/**
 * @param {string} listaId
 * @param {string} usuarioId
 * @param {{ nome: string, quantidade?: number, unidade?: string, unidades?: number, preco_estimado?: number|null, categoria_item?: string|null }} campos
 * @returns {Promise<object>}
 */
export async function criarItem(listaId, usuarioId, { nome, quantidade, unidade, unidades, preco_estimado, categoria_item }) {
  const supabase = getSupabaseAdmin()

  // Verificar ownership
  const { data: lista } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', listaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!lista) throw new Error('Lista não encontrada.')

  const nomeTrimmed = String(nome || '').trim()
  if (!nomeTrimmed || nomeTrimmed.length > 200) {
    throw new Error('Nome do item inválido (1–200 caracteres).')
  }

  const qty = quantidade !== undefined && quantidade !== null ? Number(quantidade) : 1
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }

  const unid = unidades !== undefined && unidades !== null ? Math.floor(Number(unidades)) : 1
  if (!Number.isFinite(unid) || unid < 1) {
    throw new Error('Unidades deve ser ao menos 1.')
  }

  const preco = preco_estimado !== undefined && preco_estimado !== null
    ? Number(preco_estimado)
    : null
  if (preco !== null && (!Number.isFinite(preco) || preco < 0)) {
    throw new Error('Preço estimado inválido.')
  }

  const insertPayload = {
    lista_id: listaId,
    nome: nomeTrimmed,
    quantidade: qty,
    unidade: String(unidade || 'un').trim().slice(0, 20) || 'un',
    unidades: unid,
    preco_estimado: preco,
    categoria_item: categoria_item ? String(categoria_item).trim() : null,
  }

  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_list_items')
      .insert(stripUnidadesIfMissing(insertPayload))
      .select(itemSelectCols())
      .maybeSingle()
  )

  if (error) throw new Error(error.message || 'Erro ao criar item.')
  return data
}

/**
 * @param {string} id
 * @param {string} listaId
 * @param {string} usuarioId
 * @param {Record<string, unknown>} campos
 * @returns {Promise<object>}
 */
export async function atualizarItem(id, listaId, usuarioId, campos) {
  const supabase = getSupabaseAdmin()

  // Verificar ownership via lista
  const { data: lista } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', listaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!lista) throw new Error('Lista não encontrada.')

  const update = {}

  if (campos.nome !== undefined) {
    const nomeTrimmed = String(campos.nome).trim()
    if (!nomeTrimmed || nomeTrimmed.length > 200) throw new Error('Nome do item inválido (1–200 caracteres).')
    update.nome = nomeTrimmed
  }

  if (campos.quantidade !== undefined) {
    const qty = Number(campos.quantidade)
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantidade inválida.')
    update.quantidade = qty
  }

  if (campos.unidade !== undefined) {
    update.unidade = String(campos.unidade).trim().slice(0, 20) || 'un'
  }

  if (campos.unidades !== undefined) {
    const u = Math.floor(Number(campos.unidades))
    if (!Number.isFinite(u) || u < 1) throw new Error('Unidades deve ser ao menos 1.')
    update.unidades = u
  }

  if (campos.preco_estimado !== undefined) {
    const preco = campos.preco_estimado !== null ? Number(campos.preco_estimado) : null
    if (preco !== null && (!Number.isFinite(preco) || preco < 0)) throw new Error('Preço estimado inválido.')
    update.preco_estimado = preco
  }

  if (campos.categoria_item !== undefined) {
    update.categoria_item = campos.categoria_item ? String(campos.categoria_item).trim() : null
  }

  if (Object.keys(update).length === 0) throw new Error('Nenhum campo para atualizar.')

  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_list_items')
      .update(stripUnidadesIfMissing(update))
      .eq('id', id)
      .eq('lista_id', listaId)
      .select(itemSelectCols())
      .maybeSingle()
  )

  if (error) throw new Error(error.message || 'Erro ao atualizar item.')
  if (!data) throw new Error('Item não encontrado.')
  return data
}

/**
 * Alterna checked/unchecked com checked_em.
 * @param {string} id
 * @param {string} listaId
 * @param {string} usuarioId
 * @returns {Promise<object>}
 */
export async function toggleChecked(id, listaId, usuarioId) {
  const supabase = getSupabaseAdmin()

  // Verificar ownership
  const { data: lista } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', listaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!lista) throw new Error('Lista não encontrada.')

  // Buscar estado atual
  const { data: item } = await supabase
    .from('shopping_list_items')
    .select('id, checked')
    .eq('id', id)
    .eq('lista_id', listaId)
    .maybeSingle()
  if (!item) throw new Error('Item não encontrado.')

  const novoChecked = !item.checked
  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_list_items')
      .update({
        checked: novoChecked,
        checked_em: novoChecked ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .eq('lista_id', listaId)
      .select(itemSelectCols())
      .maybeSingle()
  )

  if (error) throw new Error(error.message || 'Erro ao atualizar item.')
  return data
}

/**
 * @param {string} id
 * @param {string} listaId
 * @param {string} usuarioId
 * @returns {Promise<void>}
 */
export async function removerItem(id, listaId, usuarioId) {
  const supabase = getSupabaseAdmin()

  // Verificar ownership
  const { data: lista } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', listaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!lista) throw new Error('Lista não encontrada.')

  const { data, error } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('id', id)
    .eq('lista_id', listaId)
    .select('id')

  if (error) throw new Error(error.message || 'Erro ao remover item.')
  if (!data?.length) throw new Error('Item não encontrado.')
}

/**
 * Nomes históricos de itens do usuário, ordenados por frequência — para autocomplete.
 * @param {string} usuarioId
 * @param {number} [limit=30]
 * @returns {Promise<string[]>}
 */
export async function listarHistoricoNomes(usuarioId, limit = 30) {
  const supabase = getSupabaseAdmin()

  // Buscar itens de todas as listas do usuário
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select(`nome, shopping_lists!inner(usuario_id)`)
    .eq('shopping_lists.usuario_id', usuarioId)
    .order('nome', { ascending: true })

  if (error) throw new Error(error.message || 'Erro ao buscar histórico.')

  // Contar frequência por nome (case-insensitive) e retornar os mais frequentes
  const freq = {}
  for (const row of data || []) {
    const nome = row.nome
    const key = nome.toLowerCase()
    if (!freq[key]) freq[key] = { nome, count: 0 }
    freq[key].count++
  }

  return Object.values(freq)
    .sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limit)
    .map((e) => e.nome)
}

/**
 * @param {string} usuarioId
 * @returns {Promise<Array>}
 */
export async function listarListasArquivadas(usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('shopping_lists')
    .select(LIST_SELECT_COLS)
    .eq('usuario_id', usuarioId)
    .not('arquivada_em', 'is', null)
    .order('arquivada_em', { ascending: false })

  if (error) throw new Error(error.message || 'Erro ao listar arquivadas.')
  return data || []
}

import { getSupabaseAdmin } from './supabase-admin.mjs'
import { normalizeTipoCategoria } from './transacoes.mjs'

/** Chaves de ícone aceitas (PNGs em public/icons/categorias). NULL = automático por nome. */
export const ICONES_VALIDOS = new Set([
  'utensils', 'fuel', 'car', 'home', 'health', 'education', 'leisure',
  'shopping', 'tech', 'subscription', 'fitness', 'receipt', 'pet', 'plane',
  'gift', 'wallet', 'work', 'investment', 'child', 'bank', 'sparkles',
  'percent', 'coins', 'handCoins', 'dollarCircle', 'building', 'scale', 'pix',
])

class CategoriaError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}
export { CategoriaError }

function normNome(v, label = 'nome') {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ')
  if (s.length < 1) throw new CategoriaError(`Informe o ${label}.`)
  if (s.length > 60) throw new CategoriaError(`O ${label} é muito longo (máx. 60).`)
  return s
}

function normCor(v) {
  if (v == null || v === '') return null
  const s = String(v).trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) throw new CategoriaError('Cor inválida (use #RRGGBB).')
  return s.toLowerCase()
}

function normIcone(v) {
  if (v == null || v === '') return null
  const s = String(v).trim()
  if (!ICONES_VALIDOS.has(s)) throw new CategoriaError('Ícone inválido.')
  return s
}

/** Chave (nome normalizado + tipo) p/ detectar duplicado entre ATIVAS. */
function chave(nome, tipo) {
  return `${String(nome).trim().toLowerCase()}::${normalizeTipoCategoria(tipo)}`
}

/** Garante que a categoria existe e é do usuário. Retorna a linha. */
async function getCategoriaDoUsuario(db, uid, id) {
  const { data, error } = await db
    .from('categorias')
    .select('id, nome, tipo, cor, icone, arquivada_em, usuario_id')
    .eq('id', id)
    .eq('usuario_id', uid)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new CategoriaError('Categoria não encontrada.', 404)
  return data
}

/** Conta transações que usam a categoria (head=true, sem trazer linhas). */
async function contarTransacoes(db, uid, categoriaId) {
  const { count, error } = await db
    .from('transacoes')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', uid)
    .eq('categoria_id', categoriaId)
  if (error) throw error
  return count ?? 0
}

// ── Categorias ──────────────────────────────────────────────────────────────

export async function criarCategoria(uid, body) {
  const db = getSupabaseAdmin()
  const nome = normNome(body?.nome)
  const tipo = normalizeTipoCategoria(body?.tipo)
  const cor = normCor(body?.cor) || '#d4a84b'
  const icone = normIcone(body?.icone)

  // Bloqueia duplicado ativo (mesmo nome+tipo). Arquivada com mesmo nome é OK.
  const { data: ativas, error: eAtivas } = await db
    .from('categorias')
    .select('nome, tipo')
    .eq('usuario_id', uid)
    .is('arquivada_em', null)
  if (eAtivas) throw eAtivas
  if ((ativas || []).some((c) => chave(c.nome, c.tipo) === chave(nome, tipo))) {
    throw new CategoriaError('Já existe uma categoria ativa com esse nome.', 409)
  }

  const { data, error } = await db
    .from('categorias')
    .insert({ usuario_id: uid, nome, tipo, cor, icone })
    .select('id, nome, tipo, cor, icone')
    .maybeSingle()
  if (error) throw error
  return { ...data, subcategorias: [] }
}

export async function atualizarCategoria(uid, id, body) {
  const db = getSupabaseAdmin()
  const atual = await getCategoriaDoUsuario(db, uid, id)
  const update = {}
  if (body?.nome !== undefined) update.nome = normNome(body.nome)
  if (body?.cor !== undefined) update.cor = normCor(body.cor) || '#d4a84b'
  if (body?.icone !== undefined) update.icone = normIcone(body.icone)
  // tipo é imutável (mudar quebraria o histórico de receita/despesa).

  if (update.nome) {
    const { data: ativas } = await db
      .from('categorias')
      .select('id, nome, tipo')
      .eq('usuario_id', uid)
      .is('arquivada_em', null)
    const k = chave(update.nome, atual.tipo)
    if ((ativas || []).some((c) => c.id !== id && chave(c.nome, c.tipo) === k)) {
      throw new CategoriaError('Já existe uma categoria ativa com esse nome.', 409)
    }
  }
  if (Object.keys(update).length === 0) return atual

  const { data, error } = await db
    .from('categorias')
    .update(update)
    .eq('id', id)
    .eq('usuario_id', uid)
    .select('id, nome, tipo, cor, icone')
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Remove a categoria: arquiva se tiver transações (preserva histórico); apaga de
 * vez se estiver vazia. Retorna { modo: 'arquivada' | 'excluida' }.
 */
export async function removerCategoria(uid, id) {
  const db = getSupabaseAdmin()
  await getCategoriaDoUsuario(db, uid, id)
  const usadas = await contarTransacoes(db, uid, id)

  if (usadas > 0) {
    const { error } = await db
      .from('categorias')
      .update({ arquivada_em: new Date().toISOString() })
      .eq('id', id)
      .eq('usuario_id', uid)
    if (error) throw error
    return { modo: 'arquivada' }
  }

  // Vazia: hard delete (limpa dependências primeiro).
  await db.from('limites_orcamento').delete().eq('usuario_id', uid).eq('categoria_id', id)
  await db.from('subcategorias').delete().eq('categoria_id', id)
  const { error } = await db.from('categorias').delete().eq('id', id).eq('usuario_id', uid)
  if (error) throw error
  return { modo: 'excluida' }
}

/**
 * Funde a categoria origem na destino: move as transações (subcategoria zerada,
 * pois as subs pertencem à origem) e arquiva a origem. Mesmo tipo obrigatório.
 */
export async function fundirCategoria(uid, origemId, destinoId) {
  const db = getSupabaseAdmin()
  if (String(origemId) === String(destinoId)) {
    throw new CategoriaError('Escolha uma categoria de destino diferente.')
  }
  const origem = await getCategoriaDoUsuario(db, uid, origemId)
  const destino = await getCategoriaDoUsuario(db, uid, destinoId)
  if (normalizeTipoCategoria(origem.tipo) !== normalizeTipoCategoria(destino.tipo)) {
    throw new CategoriaError('Só dá pra fundir categorias do mesmo tipo (receita ou despesa).')
  }
  if (destino.arquivada_em) {
    throw new CategoriaError('A categoria de destino está arquivada.')
  }

  const { error: eMove } = await db
    .from('transacoes')
    .update({ categoria_id: destinoId, subcategoria_id: null })
    .eq('usuario_id', uid)
    .eq('categoria_id', origemId)
  if (eMove) throw eMove

  await db.from('limites_orcamento').delete().eq('usuario_id', uid).eq('categoria_id', origemId)
  const { error: eArq } = await db
    .from('categorias')
    .update({ arquivada_em: new Date().toISOString() })
    .eq('id', origemId)
    .eq('usuario_id', uid)
  if (eArq) throw eArq
  return { destino_id: destinoId }
}

// ── Subcategorias ───────────────────────────────────────────────────────────

/** Garante que a subcategoria existe e pertence a uma categoria do usuário. */
async function getSubDoUsuario(db, uid, subId) {
  const { data, error } = await db
    .from('subcategorias')
    .select('id, nome, categoria_id, arquivada_em, categorias!inner(usuario_id)')
    .eq('id', subId)
    .maybeSingle()
  if (error) throw error
  if (!data || data.categorias?.usuario_id !== uid) {
    throw new CategoriaError('Subcategoria não encontrada.', 404)
  }
  return data
}

export async function criarSubcategoria(uid, categoriaId, body) {
  const db = getSupabaseAdmin()
  await getCategoriaDoUsuario(db, uid, categoriaId)
  const nome = normNome(body?.nome)

  const { data: existentes } = await db
    .from('subcategorias')
    .select('nome')
    .eq('categoria_id', categoriaId)
    .is('arquivada_em', null)
  if ((existentes || []).some((s) => String(s.nome).trim().toLowerCase() === nome.toLowerCase())) {
    throw new CategoriaError('Já existe uma subcategoria com esse nome.', 409)
  }

  const { data, error } = await db
    .from('subcategorias')
    .insert({ categoria_id: categoriaId, nome })
    .select('id, categoria_id, nome')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function atualizarSubcategoria(uid, subId, body) {
  const db = getSupabaseAdmin()
  const atual = await getSubDoUsuario(db, uid, subId)
  const nome = normNome(body?.nome)

  const { data: existentes } = await db
    .from('subcategorias')
    .select('id, nome')
    .eq('categoria_id', atual.categoria_id)
    .is('arquivada_em', null)
  if ((existentes || []).some((s) => s.id !== subId && String(s.nome).trim().toLowerCase() === nome.toLowerCase())) {
    throw new CategoriaError('Já existe uma subcategoria com esse nome.', 409)
  }

  const { data, error } = await db
    .from('subcategorias')
    .update({ nome })
    .eq('id', subId)
    .select('id, categoria_id, nome')
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Contagem de uso (nº de transações) por categoria e por subcategoria do usuário.
 * Lê só 2 colunas e conta em memória (volume por usuário é pequeno). Usado na
 * tela de gestão para mostrar o que é peso morto e permitir podar.
 * @returns {Promise<{ categorias: Record<string,number>, subcategorias: Record<string,number> }>}
 */
export async function getUsoCategorias(uid) {
  const db = getSupabaseAdmin()
  const categorias = {}, subcategorias = {}
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from('transacoes')
      .select('categoria_id, subcategoria_id')
      .eq('usuario_id', uid)
      .range(from, from + pageSize - 1)
    if (error) throw error
    const rows = data || []
    for (const r of rows) {
      if (r.categoria_id) categorias[r.categoria_id] = (categorias[r.categoria_id] || 0) + 1
      if (r.subcategoria_id) subcategorias[r.subcategoria_id] = (subcategorias[r.subcategoria_id] || 0) + 1
    }
    if (rows.length < pageSize) break
  }
  return { categorias, subcategorias }
}

/** Lista as subcategorias ARQUIVADAS de uma categoria (para restaurar). */
export async function listarSubcategoriasArquivadas(uid, categoriaId) {
  const db = getSupabaseAdmin()
  await getCategoriaDoUsuario(db, uid, categoriaId)
  const { data, error } = await db
    .from('subcategorias')
    .select('id, nome')
    .eq('categoria_id', categoriaId)
    .not('arquivada_em', 'is', null)
    .order('nome', { ascending: true })
  if (error) throw error
  return data || []
}

/** Restaura (desarquiva) uma subcategoria. */
export async function restaurarSubcategoria(uid, subId) {
  const db = getSupabaseAdmin()
  await getSubDoUsuario(db, uid, subId)
  const { data, error } = await db
    .from('subcategorias')
    .update({ arquivada_em: null })
    .eq('id', subId)
    .select('id, categoria_id, nome')
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Arquiva (oculta) todas as subcategorias ATIVAS da categoria que não têm
 * nenhuma transação. Reversível via restaurarSubcategoria. Retorna quantas.
 */
export async function podarSubcategoriasSemUso(uid, categoriaId) {
  const db = getSupabaseAdmin()
  await getCategoriaDoUsuario(db, uid, categoriaId)

  const { data: subs, error: eSubs } = await db
    .from('subcategorias')
    .select('id')
    .eq('categoria_id', categoriaId)
    .is('arquivada_em', null)
  if (eSubs) throw eSubs
  const ids = (subs || []).map((s) => s.id)
  if (!ids.length) return { arquivadas: 0 }

  const { data: usadas, error: eUso } = await db
    .from('transacoes')
    .select('subcategoria_id')
    .eq('usuario_id', uid)
    .in('subcategoria_id', ids)
  if (eUso) throw eUso
  const comUso = new Set((usadas || []).map((r) => r.subcategoria_id).filter(Boolean))
  const semUso = ids.filter((id) => !comUso.has(id))
  if (!semUso.length) return { arquivadas: 0 }

  const { error } = await db
    .from('subcategorias')
    .update({ arquivada_em: new Date().toISOString() })
    .in('id', semUso)
  if (error) throw error
  return { arquivadas: semUso.length }
}

/** Arquiva a sub se usada em transações; apaga se não usada. */
export async function removerSubcategoria(uid, subId) {
  const db = getSupabaseAdmin()
  await getSubDoUsuario(db, uid, subId)

  const { count, error: eCount } = await db
    .from('transacoes')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', uid)
    .eq('subcategoria_id', subId)
  if (eCount) throw eCount

  if ((count ?? 0) > 0) {
    const { error } = await db
      .from('subcategorias')
      .update({ arquivada_em: new Date().toISOString() })
      .eq('id', subId)
    if (error) throw error
    return { modo: 'arquivada' }
  }
  const { error } = await db.from('subcategorias').delete().eq('id', subId)
  if (error) throw error
  return { modo: 'excluida' }
}

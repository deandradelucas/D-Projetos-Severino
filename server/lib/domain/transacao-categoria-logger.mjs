import { getSupabaseAdmin } from '../supabase-admin.mjs'

/**
 * Registra uma correção de categoria feita pelo usuário (descrição → categoria
 * correta), para alimentar o few-shot dinâmico de categorização.
 * Fire-and-forget — nunca bloqueia o fluxo principal.
 */
export async function logCorrecaoCategoria(usuarioId, descricao, categoriaNome, tipo) {
  try {
    const d = String(descricao || '').trim()
    const c = String(categoriaNome || '').trim()
    if (!d || d.length < 2 || !c) return
    const sb = getSupabaseAdmin()
    await sb.from('transacao_categoria_log').insert({
      usuario_id: usuarioId || null,
      descricao: d.slice(0, 120),
      categoria_nome: c.slice(0, 80),
      tipo: tipo || null,
    })
  } catch {
    // best-effort
  }
}

/**
 * Resolve o nome da categoria (pelo id) e registra a correção. Chamado pelo route
 * quando detecta que a categoria de uma transação mudou no update. Fire-and-forget.
 */
export async function registrarCorrecaoCategoria(actorId, categoriaId, descricao, tipo) {
  try {
    if (!categoriaId || !descricao) return
    const sb = getSupabaseAdmin()
    const { data: cat } = await sb.from('categorias').select('nome').eq('id', categoriaId).maybeSingle()
    if (cat?.nome) await logCorrecaoCategoria(actorId, descricao, cat.nome, tipo)
  } catch {
    // best-effort
  }
}

/**
 * Busca correções recentes de categoria DESTE usuário (categorização é pessoal —
 * sem fallback global). Dedup por descrição, mais recente primeiro.
 * Retorna [] se não houver — o prompt cai no comportamento atual.
 */
export async function buscarExemplosCategoria(usuarioId, limit = 8) {
  if (!usuarioId) return []
  try {
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('transacao_categoria_log')
      .select('descricao, categoria_nome, tipo')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false })
      .limit(limit * 3)
    const exemplos = []
    const seen = new Set()
    for (const r of data || []) {
      const key = String(r.descricao || '').toLowerCase().trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      exemplos.push({ descricao: r.descricao, categoria_nome: r.categoria_nome, tipo: r.tipo })
      if (exemplos.length >= limit) break
    }
    return exemplos
  } catch {
    return []
  }
}

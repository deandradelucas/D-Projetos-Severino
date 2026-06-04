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
 * Override DETERMINÍSTICO: se a descrição bate (normalizada, exata) com uma
 * correção recente do usuário, retorna a categoria que ele escolheu — garante o
 * aprendizado mesmo quando o LLM resistiria à instrução. Retorna null sem match.
 */
export async function resolverCategoriaPorCorrecao(usuarioId, descricao, categoriasUsuario) {
  try {
    if (!usuarioId || !descricao) return null
    const norm = (s) =>
      String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    const alvo = norm(descricao)
    if (alvo.length < 2) return null
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('transacao_categoria_log')
      .select('descricao, categoria_nome')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false })
      .limit(50)
    for (const r of data || []) {
      if (norm(r.descricao) === alvo) {
        const cat = (categoriasUsuario || []).find((c) => norm(c.nome) === norm(r.categoria_nome))
        if (cat) return { categoria_id: cat.id, subcategoria_id: null }
      }
    }
    return null
  } catch {
    return null
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

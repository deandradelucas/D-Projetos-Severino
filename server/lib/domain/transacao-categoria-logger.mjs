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

const _normCat = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Palavras genéricas de finanças/conectivos — não servem como "comerciante".
const _STOPWORDS_MERCHANT = new Set([
  'compra', 'compras', 'pagamento', 'pago', 'paguei', 'conta', 'contas', 'mensal',
  'mensalidade', 'parcela', 'parcelas', 'fatura', 'transferencia', 'boleto', 'recarga',
  'servico', 'servicos', 'valor', 'reais', 'para', 'com', 'dia', 'mes', 'meu', 'minha',
  'hoje', 'ontem', 'gastei', 'recebi', 'gasto', 'despesa', 'receita', 'dinheiro', 'cartao',
  'credito', 'debito', 'total', 'novo', 'nova', 'real', 'pelo', 'pela', 'esse', 'essa',
])

/** Tokens "de comerciante": palavras distintivas (>=4 letras, fora da stoplist). */
function _tokensMerchant(s) {
  return _normCat(s).split(' ').filter((t) => t.length >= 4 && !_STOPWORDS_MERCHANT.has(t))
}

/**
 * Override DETERMINÍSTICO (memória de comerciante): se a descrição já foi
 * corrigida antes pelo usuário, a escolha dele vence o palpite do LLM. Casa em
 * dois níveis, do mais preciso ao mais amplo:
 *   1) match exato da descrição normalizada;
 *   2) token de comerciante em comum (ex.: "iFood pizza" ~ "iFood sushi"),
 *      gated por `tipo` quando informado, mais recente vencendo.
 * Retorna { categoria_id, subcategoria_id } ou null sem match.
 */
export async function resolverCategoriaPorCorrecao(usuarioId, descricao, categoriasUsuario, tipo = null) {
  try {
    if (!usuarioId || !descricao) return null
    const alvo = _normCat(descricao)
    if (alvo.length < 2) return null
    const alvoTokens = new Set(_tokensMerchant(descricao))
    const tipoAlvo = tipo ? String(tipo).trim().toUpperCase() : null

    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('transacao_categoria_log')
      .select('descricao, categoria_nome, tipo')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false })
      .limit(80)
    const linhas = data || []
    const acharCat = (nome) => (categoriasUsuario || []).find((c) => _normCat(c.nome) === _normCat(nome))
    const tipoOk = (r) => !tipoAlvo || !r.tipo || String(r.tipo).toUpperCase() === tipoAlvo

    // 1) match exato — maior precisão
    for (const r of linhas) {
      if (tipoOk(r) && _normCat(r.descricao) === alvo) {
        const cat = acharCat(r.categoria_nome)
        if (cat) return { categoria_id: cat.id, subcategoria_id: null }
      }
    }
    // 2) memória de comerciante — token distintivo em comum (mais recente vence)
    if (alvoTokens.size) {
      for (const r of linhas) {
        if (!tipoOk(r)) continue
        if (_tokensMerchant(r.descricao).some((t) => alvoTokens.has(t))) {
          const cat = acharCat(r.categoria_nome)
          if (cat) return { categoria_id: cat.id, subcategoria_id: null }
        }
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

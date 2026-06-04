import { getSupabaseAdmin } from '../supabase-admin.mjs'

/**
 * Instrumentação temporária (medição #3): registra quando a heurística de
 * categoria sobrepõe a escolha do LLM. Anônimo (sem usuario_id). Fire-and-forget.
 * Serve para decidir, com dados, se a heurística (427 linhas) pode ser enxugada.
 */
export async function registrarMudancaHeuristica(descricao, catLlmId, catHeurId, tipo, categoriasUsuario) {
  try {
    const nomeDe = (id) => (categoriasUsuario || []).find((c) => c.id === id)?.nome || null
    const catLlm = nomeDe(catLlmId)
    const catHeur = nomeDe(catHeurId)
    if (!catLlm || !catHeur || catLlm === catHeur) return
    const sb = getSupabaseAdmin()
    await sb.from('categoria_heuristica_log').insert({
      descricao: String(descricao || '').slice(0, 120) || null,
      cat_llm: catLlm,
      cat_heuristica: catHeur,
      tipo: tipo || null,
    })
  } catch {
    // best-effort — medição nunca bloqueia o fluxo
  }
}

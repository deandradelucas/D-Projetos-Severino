import { getSupabaseAdmin } from '../supabase-admin.mjs'

function avaliarTitulo(titulo) {
  const flags = []
  if (/\d{1,2}[\s]?h(?:oras?)?\b/i.test(titulo)) flags.push('contem_hora')
  if (/\b(hoje|amanhã|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b/i.test(titulo)) flags.push('contem_dia_semana')
  if (/\b(lembre|agende|marque|coloca|anotar|registr)\b/i.test(titulo)) flags.push('contem_verbo_agendamento')
  if (titulo.trim().split(/\s+/).length > 6) flags.push('muito_longo')
  if (/^\s*(é|de|da|do)\s*$/i.test(titulo.trim())) flags.push('titulo_residual')
  const score = Math.max(0, 1 - flags.length * 0.25)
  return { flags, score }
}

/**
 * Salva uma extração de título no log para análise do @aprendizdaagenda.
 * Fire-and-forget — nunca bloqueia o fluxo principal.
 */
export async function logTituloExtracao(usuarioId, transcricao, tituloGerado, fonte, eventoId = null) {
  try {
    const { flags, score } = avaliarTitulo(tituloGerado)
    const supabase = getSupabaseAdmin()
    await supabase.from('agenda_title_log').insert({
      usuario_id: usuarioId || null,
      transcricao: String(transcricao || '').slice(0, 500),
      titulo_gerado: String(tituloGerado || ''),
      fonte,
      qualidade_score: score,
      flags: flags.length > 0 ? flags : null,
      evento_id: eventoId || null,
    })
  } catch {
    // logging é best-effort
  }
}

/**
 * Marca como editado quando o usuário muda o título de um evento.
 * Sinal mais forte de título ruim disponível.
 */
export async function logTituloEditado(eventoId, tituloNovo) {
  if (!eventoId || !tituloNovo) return
  try {
    const supabase = getSupabaseAdmin()
    const { data: existing } = await supabase
      .from('agenda_title_log')
      .select('id, titulo_gerado')
      .eq('evento_id', eventoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!existing) return
    if (existing.titulo_gerado === tituloNovo.trim()) return

    await supabase
      .from('agenda_title_log')
      .update({ usuario_editou: true, titulo_editado: tituloNovo.trim() })
      .eq('id', existing.id)
  } catch {
    // best-effort
  }
}

/**
 * Busca pares (transcrição → título corrigido pelo usuário) para few-shot dinâmico
 * no prompt de geração de título. Prioriza as correções do PRÓPRIO usuário (aprende
 * o estilo dele); completa com correções globais. Retorna [] se não houver dados
 * — nesse caso o prompt cai nos exemplos estáticos (comportamento atual).
 * Best-effort: nunca lança.
 */
export async function buscarExemplosFewShotTitulo(usuarioId, limit = 6) {
  try {
    const supabase = getSupabaseAdmin()
    const exemplos = []
    const seen = new Set()
    const add = (transcricao, titulo) => {
      const t = String(titulo || '').trim()
      const tr = String(transcricao || '').trim()
      if (!t || tr.length < 4) return
      const key = tr.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      exemplos.push({ transcricao: tr.slice(0, 160), titulo: t })
    }

    if (usuarioId) {
      const { data } = await supabase
        .from('agenda_title_log')
        .select('transcricao, titulo_editado')
        .eq('usuario_id', usuarioId)
        .eq('usuario_editou', true)
        .order('created_at', { ascending: false })
        .limit(limit)
      for (const r of data || []) add(r.transcricao, r.titulo_editado)
    }

    if (exemplos.length < limit) {
      const { data } = await supabase
        .from('agenda_title_log')
        .select('transcricao, titulo_editado')
        .eq('usuario_editou', true)
        .order('created_at', { ascending: false })
        .limit(limit * 2)
      for (const r of data || []) {
        if (exemplos.length >= limit) break
        add(r.transcricao, r.titulo_editado)
      }
    }

    return exemplos.slice(0, limit)
  } catch {
    return []
  }
}

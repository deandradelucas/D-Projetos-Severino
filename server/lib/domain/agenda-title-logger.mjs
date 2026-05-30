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

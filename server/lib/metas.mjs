import { getSupabaseAdmin } from './supabase-admin.mjs'
import { log } from './logger.mjs'

const META_COLS =
  'id, usuario_id, nome, icone, cor, valor_alvo, valor_guardado, prazo, concluida_em, arquivada_em, criada_em, atualizada_em'

const CORES_VALIDAS = ['gold', 'green', 'blue', 'purple', 'red', 'teal']

function normalizarNome(nome) {
  const t = String(nome || '').trim()
  if (!t || t.length > 80) throw new Error('Nome da meta inválido (1–80 caracteres).')
  return t
}

function normalizarValor(valor, { obrigatorio = true } = {}) {
  const n = Number(valor)
  if (!Number.isFinite(n)) {
    if (obrigatorio) throw new Error('Valor inválido.')
    return null
  }
  return Math.round(n * 100) / 100
}

function normalizarCor(cor) {
  const c = String(cor || 'gold').trim().toLowerCase()
  return CORES_VALIDAS.includes(c) ? c : 'gold'
}

function normalizarPrazo(prazo) {
  if (!prazo) return null
  const s = String(prazo).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/** Lista as metas ativas (não arquivadas) do escopo (pessoal ou família). */
export async function listarMetas(usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('metas')
    .select(META_COLS)
    .eq('usuario_id', usuarioId)
    .is('arquivada_em', null)
    .order('concluida_em', { ascending: true, nullsFirst: true })
    .order('criada_em', { ascending: false })
  if (error) throw new Error(error.message || 'Erro ao listar metas.')
  return data || []
}

export async function criarMeta(usuarioId, { nome, icone, cor, valor_alvo, prazo }) {
  const payload = {
    usuario_id: usuarioId,
    nome: normalizarNome(nome),
    icone: String(icone || '🎯').slice(0, 8) || '🎯',
    cor: normalizarCor(cor),
    valor_alvo: normalizarValor(valor_alvo),
    prazo: normalizarPrazo(prazo),
  }
  if (!(payload.valor_alvo >= 0.01)) throw new Error('Valor da meta deve ser maior que zero.')

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('metas').insert(payload).select(META_COLS).maybeSingle()
  if (error) throw new Error(error.message || 'Erro ao criar meta.')
  return data
}

export async function atualizarMeta(usuarioId, metaId, patch) {
  const fields = {}
  if (patch.nome !== undefined) fields.nome = normalizarNome(patch.nome)
  if (patch.icone !== undefined) fields.icone = String(patch.icone || '🎯').slice(0, 8) || '🎯'
  if (patch.cor !== undefined) fields.cor = normalizarCor(patch.cor)
  if (patch.prazo !== undefined) fields.prazo = normalizarPrazo(patch.prazo)
  if (patch.valor_alvo !== undefined) {
    const v = normalizarValor(patch.valor_alvo)
    if (!(v >= 0.01)) throw new Error('Valor da meta deve ser maior que zero.')
    fields.valor_alvo = v
  }
  if (Object.keys(fields).length === 0) throw new Error('Nada para atualizar.')
  fields.atualizada_em = new Date().toISOString()

  const supabase = getSupabaseAdmin()
  // Recalcula conclusão se o alvo mudou
  const { data, error } = await supabase
    .from('metas')
    .update(fields)
    .eq('id', metaId)
    .eq('usuario_id', usuarioId)
    .select(META_COLS)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Erro ao atualizar meta.')
  if (!data) throw new Error('Meta não encontrada.')

  if (fields.valor_alvo !== undefined) {
    const concluida = Number(data.valor_guardado) >= Number(data.valor_alvo)
    const novoConcluida = concluida ? data.concluida_em || new Date().toISOString() : null
    if ((data.concluida_em || null) !== novoConcluida) {
      const { data: d2 } = await supabase
        .from('metas')
        .update({ concluida_em: novoConcluida })
        .eq('id', metaId)
        .eq('usuario_id', usuarioId)
        .select(META_COLS)
        .maybeSingle()
      return d2 || data
    }
  }
  return data
}

export async function arquivarMeta(usuarioId, metaId) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('metas')
    .update({ arquivada_em: new Date().toISOString() })
    .eq('id', metaId)
    .eq('usuario_id', usuarioId)
  if (error) throw new Error(error.message || 'Erro ao arquivar meta.')
  return { ok: true }
}

export async function excluirMeta(usuarioId, metaId) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('metas').delete().eq('id', metaId).eq('usuario_id', usuarioId)
  if (error) throw new Error(error.message || 'Erro ao excluir meta.')
  return { ok: true }
}

/**
 * Registra um aporte (positivo = guardar, negativo = resgatar) e atualiza o valor guardado.
 * O valor guardado nunca fica negativo. Marca/desmarca conclusão automaticamente.
 */
export async function adicionarAporte(usuarioId, metaId, valor, nota) {
  const v = normalizarValor(valor)
  if (!Number.isFinite(v) || v === 0) throw new Error('Informe um valor diferente de zero.')

  const supabase = getSupabaseAdmin()
  const { data: meta, error: metaErr } = await supabase
    .from('metas')
    .select('id, valor_alvo, valor_guardado, concluida_em')
    .eq('id', metaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (metaErr) throw new Error(metaErr.message || 'Erro ao buscar meta.')
  if (!meta) throw new Error('Meta não encontrada.')

  const atual = Number(meta.valor_guardado) || 0
  const novoGuardado = Math.max(0, Math.round((atual + v) * 100) / 100)
  const aporteReal = Math.round((novoGuardado - atual) * 100) / 100
  if (aporteReal === 0) throw new Error('Não há valor guardado para resgatar.')

  const concluida = novoGuardado >= Number(meta.valor_alvo)
  const concluidaEm = concluida ? meta.concluida_em || new Date().toISOString() : null

  const { error: aporteErr } = await supabase.from('meta_aportes').insert({
    meta_id: metaId,
    usuario_id: usuarioId,
    valor: aporteReal,
    nota: nota ? String(nota).slice(0, 140) : null,
  })
  if (aporteErr) throw new Error(aporteErr.message || 'Erro ao registrar aporte.')

  const { data, error } = await supabase
    .from('metas')
    .update({ valor_guardado: novoGuardado, concluida_em: concluidaEm, atualizada_em: new Date().toISOString() })
    .eq('id', metaId)
    .eq('usuario_id', usuarioId)
    .select(META_COLS)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Erro ao atualizar meta.')
  return data
}

export async function listarAportes(usuarioId, metaId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('meta_aportes')
    .select('id, valor, nota, criado_em, metas!inner(usuario_id)')
    .eq('meta_id', metaId)
    .eq('metas.usuario_id', usuarioId)
    .order('criado_em', { ascending: false })
    .limit(100)
  if (error) {
    log.error('listar aportes meta', error)
    throw new Error(error.message || 'Erro ao listar aportes.')
  }
  return (data || []).map(({ id, valor, nota, criado_em }) => ({ id, valor, nota, criado_em }))
}

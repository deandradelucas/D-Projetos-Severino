import { getSupabaseAdmin } from './supabase-admin.mjs'

/** Chaves aceites no POST `preset`; `nome` gravado é o valor legível. */
export const INVESTIMENTO_PRESETS = Object.freeze({
  LCA: 'LCA',
  LCI: 'LCI',
  CDB: 'CDB',
  CDI: 'CDI',
  POUPANCA: 'Poupança',
})

const PRESET_KEYS = new Set(Object.keys(INVESTIMENTO_PRESETS))

function cleanNomeCustom(value) {
  return String(value ?? '').trim().slice(0, 120)
}

function cleanInstituicao(value) {
  return String(value ?? '').trim().slice(0, 120)
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ tipo_preset: string | null, nome: string, instituicao_nome: string }}
 */
export function parseInvestimentoCreateBody(body) {
  const instituicao_nome = cleanInstituicao(body?.instituicao_nome)
  if (instituicao_nome.length < 2) {
    throw new Error('Informe o banco ou corretora (mínimo 2 caracteres).')
  }

  const presetRaw = String(body?.preset ?? '').trim().toUpperCase()
  const custom = cleanNomeCustom(body?.nome_custom)

  if (presetRaw && PRESET_KEYS.has(presetRaw)) {
    return {
      tipo_preset: presetRaw,
      nome: INVESTIMENTO_PRESETS[presetRaw],
      instituicao_nome,
    }
  }

  if (custom.length < 2) {
    throw new Error('Escolha um tipo na lista ou informe outro investimento (mínimo 2 caracteres).')
  }

  return { tipo_preset: null, nome: custom, instituicao_nome }
}

function rowToApi(row) {
  if (!row) return row
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    tipo_preset: row.tipo_preset,
    nome: row.nome,
    instituicao_nome: row.instituicao_nome,
    criado_em: row.criado_em,
  }
}

/**
 * @param {string} usuarioId
 */
export async function listarInvestimentosUsuario(usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('investimentos_usuario')
    .select('id, usuario_id, tipo_preset, nome, instituicao_nome, criado_em')
    .eq('usuario_id', usuarioId)
    .order('criado_em', { ascending: false })

  if (error) throw new Error(error.message || 'Erro ao listar investimentos.')
  return (data || []).map(rowToApi)
}

/**
 * @param {string} usuarioId
 * @param {Record<string, unknown>} body
 */
export async function criarInvestimentoUsuario(usuarioId, body) {
  const { tipo_preset, nome, instituicao_nome } = parseInvestimentoCreateBody(body)
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('investimentos_usuario')
    .insert({
      usuario_id: usuarioId,
      tipo_preset,
      nome,
      instituicao_nome,
    })
    .select('id, usuario_id, tipo_preset, nome, instituicao_nome, criado_em')
    .maybeSingle()

  if (error) throw new Error(error.message || 'Erro ao criar investimento.')
  return rowToApi(data)
}

/**
 * @param {string} id
 * @param {string} usuarioId
 */
export async function removerInvestimentoUsuario(id, usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('investimentos_usuario')
    .delete()
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .select('id')

  if (error) throw new Error(error.message || 'Erro ao remover investimento.')
  if (!data?.length) throw new Error('Investimento não encontrado.')
}

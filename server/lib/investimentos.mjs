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
 * Aceita número JSON ou texto pt-BR (ex.: 1.234,56).
 * @param {unknown} raw
 * @returns {number}
 */
export function parseValorInvestido(raw) {
  if (raw === undefined || raw === null) {
    throw new Error('Informe o valor investido.')
  }
  if (typeof raw === 'number') {
    const rounded = Math.round(raw * 100) / 100
    if (!Number.isFinite(rounded)) throw new Error('Valor investido inválido.')
    if (rounded < 0.01) throw new Error('Valor investido deve ser no mínimo R$ 0,01.')
    if (rounded > 999_999_999_999.99) throw new Error('Valor acima do limite permitido.')
    return rounded
  }
  const s = String(raw).trim().replace(/\s/g, '')
  if (!s) throw new Error('Informe o valor investido.')
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalized)
  if (!Number.isFinite(n)) throw new Error('Valor investido inválido.')
  const rounded = Math.round(n * 100) / 100
  if (rounded < 0.01) throw new Error('Valor investido deve ser no mínimo R$ 0,01.')
  if (rounded > 999_999_999_999.99) throw new Error('Valor acima do limite permitido.')
  return rounded
}

/**
 * % do CDI contratado (ex.: 100 ou 110,5).
 * @param {unknown} raw
 * @returns {number}
 */
export function parsePercentualCdi(raw) {
  if (raw === undefined || raw === null) {
    throw new Error('Informe o percentual do CDI contratado.')
  }
  if (typeof raw === 'number') {
    const rounded = Math.round(raw * 100) / 100
    if (!Number.isFinite(rounded)) throw new Error('Percentual do CDI inválido.')
    if (rounded < 0.01) throw new Error('Percentual do CDI deve ser no mínimo 0,01%.')
    if (rounded > 9999.99) throw new Error('Percentual do CDI acima do limite permitido.')
    return rounded
  }
  const s = String(raw)
    .trim()
    .replace(/%/g, '')
    .replace(/\s/g, '')
  if (!s) throw new Error('Informe o percentual do CDI contratado.')
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalized)
  if (!Number.isFinite(n)) throw new Error('Percentual do CDI inválido.')
  const rounded = Math.round(n * 100) / 100
  if (rounded < 0.01) throw new Error('Percentual do CDI deve ser no mínimo 0,01%.')
  if (rounded > 9999.99) throw new Error('Percentual do CDI acima do limite permitido.')
  return rounded
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ tipo_preset: string | null, nome: string, instituicao_nome: string, valor_investido: number, percentual_cdi: number }}
 */
export function parseInvestimentoCreateBody(body) {
  const instituicao_nome = cleanInstituicao(body?.instituicao_nome)
  if (instituicao_nome.length < 2) {
    throw new Error('Informe o banco ou corretora (mínimo 2 caracteres).')
  }

  const valor_investido = parseValorInvestido(body?.valor_investido)
  const percentual_cdi = parsePercentualCdi(body?.percentual_cdi)

  const presetRaw = String(body?.preset ?? '').trim().toUpperCase()
  const custom = cleanNomeCustom(body?.nome_custom)

  if (presetRaw && PRESET_KEYS.has(presetRaw)) {
    return {
      tipo_preset: presetRaw,
      nome: INVESTIMENTO_PRESETS[presetRaw],
      instituicao_nome,
      valor_investido,
      percentual_cdi,
    }
  }

  if (custom.length < 2) {
    throw new Error('Escolha um tipo na lista ou informe outro investimento (mínimo 2 caracteres).')
  }

  return { tipo_preset: null, nome: custom, instituicao_nome, valor_investido, percentual_cdi }
}

function rowToApi(row) {
  if (!row) return row
  const vi = row.valor_investido
  const pc = row.percentual_cdi
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    tipo_preset: row.tipo_preset,
    nome: row.nome,
    instituicao_nome: row.instituicao_nome,
    valor_investido: vi != null ? Number(vi) : null,
    percentual_cdi: pc != null ? Number(pc) : null,
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
    .select('id, usuario_id, tipo_preset, nome, instituicao_nome, valor_investido, percentual_cdi, criado_em')
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
  const { tipo_preset, nome, instituicao_nome, valor_investido, percentual_cdi } = parseInvestimentoCreateBody(body)
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('investimentos_usuario')
    .insert({
      usuario_id: usuarioId,
      tipo_preset,
      nome,
      instituicao_nome,
      valor_investido,
      percentual_cdi,
    })
    .select('id, usuario_id, tipo_preset, nome, instituicao_nome, valor_investido, percentual_cdi, criado_em')
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

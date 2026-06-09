import { getSupabaseAdmin } from './supabase-admin.mjs'
import { log } from './logger.mjs'

const CARTAO_COLS =
  'id, usuario_id, nome, bandeira, cor, limite, dia_fechamento, dia_vencimento, arquivado_em, criado_em, atualizado_em'

const CORES_VALIDAS = ['gold', 'green', 'blue', 'purple', 'red', 'teal', 'dark']
const BANDEIRAS = ['visa', 'master', 'elo', 'amex', 'hipercard', 'outro']

// ── Helpers de data / ciclo de fatura ───────────────────────────────────────
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function clampDay(year, monthIdx, day) {
  const last = new Date(year, monthIdx + 1, 0).getDate()
  return Math.min(Math.max(1, day), last)
}
function closingDate(year, monthIdx, diaFech) {
  return new Date(year, monthIdx, clampDay(year, monthIdx, diaFech))
}
/** Período [ini, fim] (datas) da fatura que fecha em (year, monthIdx). */
function cicloFatura(year, monthIdx, diaFech) {
  const fim = closingDate(year, monthIdx, diaFech)
  const prevClose = closingDate(year, monthIdx - 1, diaFech)
  const ini = new Date(prevClose)
  ini.setDate(ini.getDate() + 1)
  return { ini, fim }
}
/** Vencimento da fatura que fecha em (year, monthIdx) — sempre após o fechamento. */
function vencimentoFatura(year, monthIdx, diaFech, diaVenc) {
  const fim = closingDate(year, monthIdx, diaFech)
  let v = closingDate(year, monthIdx, diaVenc)
  if (v <= fim) v = closingDate(year, monthIdx + 1, diaVenc)
  return v
}
/** Referência (year, monthIdx) da fatura ABERTA hoje — onde entram os gastos
 *  do ciclo atual (compras novas aparecem aqui). Vencimento = o desta fatura. */
function refAtual(diaFech, hoje = new Date()) {
  const fech = closingDate(hoje.getFullYear(), hoje.getMonth(), diaFech)
  const base = hoje > fech ? new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1) : hoje
  return { year: base.getFullYear(), monthIdx: base.getMonth() }
}
function parseRef(ref) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ref || ''))
  if (!m) return null
  return { year: Number(m[1]), monthIdx: Number(m[2]) - 1 }
}
function refToStr({ year, monthIdx }) {
  const d = new Date(year, monthIdx, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function diaSeguinte(d) {
  const x = new Date(d)
  x.setDate(x.getDate() + 1)
  return x
}

// ── Normalização ─────────────────────────────────────────────────────────────
function normNome(nome) {
  const t = String(nome || '').trim()
  if (!t || t.length > 60) throw new Error('Nome do cartão inválido (1–60 caracteres).')
  return t
}
function normDia(v, campo) {
  const n = Math.trunc(Number(v))
  if (!Number.isFinite(n) || n < 1 || n > 31) throw new Error(`${campo} deve ser entre 1 e 31.`)
  return n
}
function normCor(c) {
  const v = String(c || 'gold').trim().toLowerCase()
  return CORES_VALIDAS.includes(v) ? v : 'gold'
}
function normBandeira(b) {
  const v = String(b || '').trim().toLowerCase()
  return BANDEIRAS.includes(v) ? v : null
}
function normLimite(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

// ── Soma da fatura num período ───────────────────────────────────────────────
async function somaPeriodo(usuarioId, cartaoId, ini, fim) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('transacoes')
    .select('valor, tipo')
    .eq('usuario_id', usuarioId)
    .eq('cartao_id', cartaoId)
    .gte('data_transacao', ymd(ini))
    .lt('data_transacao', ymd(diaSeguinte(fim)))
  if (error) throw new Error(error.message || 'Erro ao somar fatura.')
  let total = 0
  for (const t of data || []) {
    const v = Number(t.valor) || 0
    total += t.tipo === 'receita' ? -v : v
  }
  return Math.round(total * 100) / 100
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
export async function listarCartoes(usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('cartoes')
    .select(CARTAO_COLS)
    .eq('usuario_id', usuarioId)
    .is('arquivado_em', null)
    .order('criado_em', { ascending: true })
  if (error) throw new Error(error.message || 'Erro ao listar cartões.')
  return data || []
}

/** Lista cartões + resumo da fatura aberta (total, vencimento, uso do limite). */
export async function listarCartoesComResumo(usuarioId) {
  const cartoes = await listarCartoes(usuarioId)
  const out = []
  for (const c of cartoes) {
    const ref = refAtual(c.dia_fechamento)
    const { ini, fim } = cicloFatura(ref.year, ref.monthIdx, c.dia_fechamento)
    const total = await somaPeriodo(usuarioId, c.id, ini, fim)
    const venc = vencimentoFatura(ref.year, ref.monthIdx, c.dia_fechamento, c.dia_vencimento)
    out.push({
      ...c,
      fatura_atual: {
        ref: refToStr(ref),
        ini: ymd(ini),
        fim: ymd(fim),
        vencimento: ymd(venc),
        total,
      },
    })
  }
  return out
}

export async function criarCartao(usuarioId, body) {
  const payload = {
    usuario_id: usuarioId,
    nome: normNome(body.nome),
    bandeira: normBandeira(body.bandeira),
    cor: normCor(body.cor),
    limite: normLimite(body.limite),
    dia_fechamento: normDia(body.dia_fechamento, 'Dia de fechamento'),
    dia_vencimento: normDia(body.dia_vencimento, 'Dia de vencimento'),
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('cartoes').insert(payload).select(CARTAO_COLS).maybeSingle()
  if (error) throw new Error(error.message || 'Erro ao criar cartão.')
  return data
}

export async function atualizarCartao(usuarioId, cartaoId, body) {
  const fields = {}
  if (body.nome !== undefined) fields.nome = normNome(body.nome)
  if (body.bandeira !== undefined) fields.bandeira = normBandeira(body.bandeira)
  if (body.cor !== undefined) fields.cor = normCor(body.cor)
  if (body.limite !== undefined) fields.limite = normLimite(body.limite)
  if (body.dia_fechamento !== undefined) fields.dia_fechamento = normDia(body.dia_fechamento, 'Dia de fechamento')
  if (body.dia_vencimento !== undefined) fields.dia_vencimento = normDia(body.dia_vencimento, 'Dia de vencimento')
  if (Object.keys(fields).length === 0) throw new Error('Nada para atualizar.')
  fields.atualizado_em = new Date().toISOString()

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('cartoes')
    .update(fields)
    .eq('id', cartaoId)
    .eq('usuario_id', usuarioId)
    .select(CARTAO_COLS)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Erro ao atualizar cartão.')
  if (!data) throw new Error('Cartão não encontrado.')
  return data
}

export async function excluirCartao(usuarioId, cartaoId) {
  // FK ON DELETE SET NULL desvincula as transações automaticamente.
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('cartoes').delete().eq('id', cartaoId).eq('usuario_id', usuarioId)
  if (error) throw new Error(error.message || 'Erro ao excluir cartão.')
  return { ok: true }
}

/** Busca no histórico completo do cartão (todas as faturas) por descrição. */
export async function buscarTransacoesCartao(usuarioId, cartaoId, termo, limite = 60) {
  const supabase = getSupabaseAdmin()
  // valida posse do cartão
  const { data: cartao, error: cErr } = await supabase
    .from('cartoes')
    .select('id')
    .eq('id', cartaoId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (cErr) throw new Error(cErr.message || 'Erro ao buscar cartão.')
  if (!cartao) throw new Error('Cartão não encontrado.')

  let q = supabase
    .from('transacoes')
    .select('id, valor, tipo, descricao, data_transacao, recorrente_index, recorrente_total')
    .eq('usuario_id', usuarioId)
    .eq('cartao_id', cartaoId)

  const t = String(termo || '').trim()
  if (t) {
    // ilike com escape de % e _ (busca por substring na descrição)
    const safe = t.replace(/[%_]/g, (ch) => `\\${ch}`)
    q = q.ilike('descricao', `%${safe}%`)
  }

  const { data, error } = await q
    .order('data_transacao', { ascending: false })
    .limit(Math.min(Math.max(1, Number(limite) || 60), 200))
  if (error) {
    log.error('buscar transacoes cartao', error)
    throw new Error(error.message || 'Erro ao buscar histórico.')
  }
  return data || []
}

/** Remove o sufixo "(x/n)" da descrição de uma parcela. */
function limparDescricaoParcela(desc) {
  return String(desc || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
}

/**
 * Lista as compras PARCELADAS ativas (com parcelas pendentes) de um cartão,
 * agrupadas por grupo de parcelamento, com progresso e valor restante.
 */
export async function listarParceladasCartao(usuarioId, cartaoId) {
  const supabase = getSupabaseAdmin()
  const { data: cartao, error: cErr } = await supabase
    .from('cartoes')
    .select('id')
    .eq('id', cartaoId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (cErr) throw new Error(cErr.message || 'Erro ao buscar cartão.')
  if (!cartao) throw new Error('Cartão não encontrado.')

  const { data: txs, error } = await supabase
    .from('transacoes')
    .select('id, valor, descricao, data_transacao, data_compra, status, recorrente_grupo_id, recorrente_index, recorrente_total')
    .eq('usuario_id', usuarioId)
    .eq('cartao_id', cartaoId)
    .not('recorrente_grupo_id', 'is', null)
    .order('recorrente_index', { ascending: true })
  if (error) {
    log.error('listar parceladas cartao', error)
    throw new Error(error.message || 'Erro ao buscar parceladas.')
  }

  const grupos = new Map()
  for (const t of txs || []) {
    const gid = t.recorrente_grupo_id
    if (!grupos.has(gid)) {
      grupos.set(gid, {
        grupo_id: gid,
        descricao: limparDescricaoParcela(t.descricao),
        data_compra: t.data_compra || null,
        total: t.recorrente_total || 0,
        parcelas: [],
      })
    }
    grupos.get(gid).parcelas.push(t)
  }

  const out = []
  for (const g of grupos.values()) {
    const pendentes = g.parcelas.filter((p) => p.status === 'PENDENTE')
    if (pendentes.length === 0) continue // só ativas (com parcelas a pagar)
    const total = g.total || g.parcelas.length
    const valorRestante = pendentes.reduce((s, p) => s + (Number(p.valor) || 0), 0)
    const proxima = pendentes.reduce(
      (min, p) => (!min || (p.recorrente_index || Infinity) < (min.recorrente_index || Infinity) ? p : min),
      null
    )
    out.push({
      grupo_id: g.grupo_id,
      descricao: g.descricao,
      data_compra: g.data_compra,
      total,
      pendentes: pendentes.length,
      pagas: Math.max(0, total - pendentes.length),
      proxima_parcela: proxima?.recorrente_index ?? total - pendentes.length + 1,
      proximo_vencimento: proxima?.data_transacao ?? null,
      valor_parcela: Number(proxima?.valor) || 0,
      valor_restante: valorRestante,
    })
  }
  out.sort((a, b) => String(a.proximo_vencimento || '').localeCompare(String(b.proximo_vencimento || '')))
  return out
}

/** Fatura detalhada de um cartão para uma referência (YYYY-MM = mês de fechamento). */
export async function faturaDoCartao(usuarioId, cartaoId, ref) {
  const supabase = getSupabaseAdmin()
  const { data: cartao, error: cErr } = await supabase
    .from('cartoes')
    .select(CARTAO_COLS)
    .eq('id', cartaoId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (cErr) throw new Error(cErr.message || 'Erro ao buscar cartão.')
  if (!cartao) throw new Error('Cartão não encontrado.')

  const refObj = parseRef(ref) || refAtual(cartao.dia_fechamento)
  const { ini, fim } = cicloFatura(refObj.year, refObj.monthIdx, cartao.dia_fechamento)
  const venc = vencimentoFatura(refObj.year, refObj.monthIdx, cartao.dia_fechamento, cartao.dia_vencimento)

  const { data: txs, error: tErr } = await supabase
    .from('transacoes')
    .select('id, valor, tipo, descricao, data_transacao, categoria_id, recorrente_index, recorrente_total')
    .eq('usuario_id', usuarioId)
    .eq('cartao_id', cartaoId)
    .gte('data_transacao', ymd(ini))
    .lt('data_transacao', ymd(diaSeguinte(fim)))
    .order('data_transacao', { ascending: false })
  if (tErr) {
    log.error('fatura transacoes', tErr)
    throw new Error(tErr.message || 'Erro ao buscar transações da fatura.')
  }

  let total = 0
  for (const t of txs || []) total += t.tipo === 'receita' ? -(Number(t.valor) || 0) : Number(t.valor) || 0

  return {
    cartao: { id: cartao.id, nome: cartao.nome, cor: cartao.cor, bandeira: cartao.bandeira },
    ref: refToStr(refObj),
    ini: ymd(ini),
    fim: ymd(fim),
    vencimento: ymd(venc),
    total: Math.round(total * 100) / 100,
    transacoes: txs || [],
  }
}

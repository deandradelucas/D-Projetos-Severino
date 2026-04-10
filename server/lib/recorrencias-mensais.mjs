import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'

const TZ = 'America/Sao_Paulo'

export function monthKeyBrazil(isoOrDate) {
  const d =
    typeof isoOrDate === 'string' || isoOrDate instanceof Date
      ? new Date(isoOrDate)
      : new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  return `${y}-${m}`
}

export function brazilCalendarFromDate(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  return {
    year: parseInt(parts.find((p) => p.type === 'year').value, 10),
    month: parseInt(parts.find((p) => p.type === 'month').value, 10),
    day: parseInt(parts.find((p) => p.type === 'day').value, 10),
  }
}

function addMonthKey(ym, delta = 1) {
  const [y, m] = ym.split('-').map(Number)
  const idx = y * 12 + (m - 1) + delta
  const ny = Math.floor(idx / 12)
  const nm = (idx % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function compareMonthKeys(a, b) {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return ay * 12 + am - (by * 12 + bm)
}

/** Dia 1 do mês YYYY-MM, ~09:00 America/Sao_Paulo → 12:00 UTC (offset fixo -3). */
export function primeiroDiaMesMidMorningIso(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)).toISOString()
}

async function inserirTransacaoGerada(supabase, usuarioId, rule, dataIso) {
  const { error } = await supabase.from('transacoes').insert({
    usuario_id: usuarioId,
    tipo: rule.tipo,
    valor: rule.valor,
    descricao: rule.descricao ?? '',
    status: 'EFETIVADA',
    categoria_id: rule.categoria_id,
    subcategoria_id: rule.subcategoria_id,
    data_transacao: dataIso,
  })
  if (error) throw error
}

/**
 * Cria regra após salvar a primeira transação (mesmo fluxo do modal).
 * ultima_geracao_mes = mês (BR) da data da transação salva — evita duplicar no mesmo mês.
 */
export async function criarRegraRecorrenciaDia1(usuarioId, primeiraLinha) {
  const supabase = getSupabaseAdmin()
  const mesRef = monthKeyBrazil(primeiraLinha.data_transacao)
  const { data, error } = await supabase
    .from('recorrencias_mensais')
    .insert({
      usuario_id: usuarioId,
      tipo: primeiraLinha.tipo,
      valor: primeiraLinha.valor,
      descricao: primeiraLinha.descricao ?? '',
      categoria_id: primeiraLinha.categoria_id ?? null,
      subcategoria_id: primeiraLinha.subcategoria_id ?? null,
      dia_mes: 1,
      ativo: true,
      ultima_geracao_mes: mesRef,
    })
    .select('id')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function listarRecorrenciasMensais(usuarioId) {
  const supabase = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid) return []

  const { data, error } = await supabase
    .from('recorrencias_mensais')
    .select(
      'id, tipo, valor, descricao, categoria_id, subcategoria_id, dia_mes, ativo, ultima_geracao_mes, created_at'
    )
    .eq('usuario_id', uid)
    .eq('ativo', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function desativarRecorrenciaMensal(id, usuarioId) {
  const supabase = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  const { error } = await supabase
    .from('recorrencias_mensais')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', uid)

  if (error) throw error
  return true
}

/**
 * Gera lançamentos faltantes: enquanto existir mês entre (ultima_geracao_mes, mês atual BR], cria no dia 1.
 */
export async function processarRecorrenciasPendentes(usuarioIdFilter = null) {
  const supabase = getSupabaseAdmin()
  const br = brazilCalendarFromDate()
  const mesAtual = `${br.year}-${String(br.month).padStart(2, '0')}`

  let q = supabase
    .from('recorrencias_mensais')
    .select(
      'id, usuario_id, tipo, valor, descricao, categoria_id, subcategoria_id, ultima_geracao_mes, ativo'
    )
    .eq('ativo', true)

  if (usuarioIdFilter) {
    q = q.eq('usuario_id', String(usuarioIdFilter).trim())
  }

  const { data: rules, error } = await q
  if (error) throw error
  if (!rules?.length) return { regras: 0, inseridas: 0 }

  let inseridas = 0

  for (const rule of rules) {
    let ultima = rule.ultima_geracao_mes
    if (!ultima || !/^\d{4}-\d{2}$/.test(ultima)) {
      log.warn('[recorrencias] regra com ultima_geracao_mes inválida', rule.id)
      continue
    }

    while (true) {
      const proximoMes = addMonthKey(ultima, 1)
      if (compareMonthKeys(proximoMes, mesAtual) > 0) break

      const dataIso = primeiroDiaMesMidMorningIso(proximoMes)
      await inserirTransacaoGerada(supabase, rule.usuario_id, rule, dataIso)
      inseridas++

      const { error: upErr } = await supabase
        .from('recorrencias_mensais')
        .update({ ultima_geracao_mes: proximoMes, updated_at: new Date().toISOString() })
        .eq('id', rule.id)

      if (upErr) throw upErr
      ultima = proximoMes
    }
  }

  return { regras: rules.length, inseridas }
}

export function assertCronSecret(c) {
  const expected = process.env.CRON_SECRET
  if (!expected || String(expected).trim() === '') {
    log.warn('[cron] CRON_SECRET não configurado — rota desativada')
    return { ok: false, status: 503, message: 'Cron não configurado.' }
  }
  const auth = c.req.header('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const header = c.req.header('x-cron-secret') || ''
  if (bearer === expected || header === expected) {
    return { ok: true }
  }
  return { ok: false, status: 401, message: 'Não autorizado.' }
}

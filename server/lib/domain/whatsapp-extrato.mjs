import { getTransacoes } from '../transacoes.mjs'

const TZ = 'America/Sao_Paulo'

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Partes calendário em São Paulo (YYYY, MM, DD como strings en-CA). */
function spYmd(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const g = (t) => p.find((x) => x.type === t)?.value
  return { y: g('year'), m: g('month'), d: g('day') }
}

function isoStartOfDaySP(y, m, d) {
  return new Date(`${y}-${m}-${d}T00:00:00-03:00`).toISOString()
}

function isoEndOfDaySP(y, m, d) {
  return new Date(`${y}-${m}-${d}T23:59:59.999-03:00`).toISOString()
}

function addDaysFromSpYmd(y, m, d, delta) {
  const t = new Date(`${y}-${m}-${d}T12:00:00-03:00`)
  t.setUTCDate(t.getUTCDate() + delta)
  return spYmd(t)
}

/** Segunda-feira 00:00 até domingo 23:59:59 da semana que contém `ref` (calendário SP). */
function boundsSemanaSP(ref = new Date()) {
  let { y, m, d } = spYmd(ref)
  let t = new Date(`${y}-${m}-${d}T12:00:00-03:00`)
  for (let i = 0; i < 7; i++) {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(t)
    if (String(wd).startsWith('Mon')) break
    t = new Date(t.getTime() - 24 * 60 * 60 * 1000)
  }
  ;({ y, m, d } = spYmd(t))
  const startIso = isoStartOfDaySP(y, m, d)
  const endParts = addDaysFromSpYmd(y, m, d, 6)
  const endIso = isoEndOfDaySP(endParts.y, endParts.m, endParts.d)
  const label = `${pad2(d)}/${pad2(m)}/${y} – ${pad2(endParts.d)}/${pad2(endParts.m)}/${endParts.y}`
  return { dataInicio: startIso, dataFim: endIso, label }
}

function boundsMesSP(ref = new Date()) {
  const { y, m } = spYmd(ref)
  const yi = Number.parseInt(y, 10)
  const mi = Number.parseInt(m, 10)
  const lastDay = new Date(yi, mi, 0).getDate()
  const startIso = isoStartOfDaySP(y, m, '01')
  const endIso = isoEndOfDaySP(y, m, pad2(lastDay))
  const label = `${pad2(mi)}/${yi}`
  return { dataInicio: startIso, dataFim: endIso, label }
}

function boundsDiaSP(ref = new Date()) {
  const { y, m, d } = spYmd(ref)
  return {
    dataInicio: isoStartOfDaySP(y, m, d),
    dataFim: isoEndOfDaySP(y, m, d),
    label: `${pad2(d)}/${pad2(m)}/${y}`,
  }
}

/**
 * Detecta pedido de histórico/extrato no WhatsApp.
 * @returns {{ periodo: 'dia'|'semana'|'mes', tipo: 'ambos'|'DESPESA'|'RECEITA' } | null}
 */
export function detectExtratoPedido(message) {
  const raw = String(message || '').trim()
  if (!raw) return null
  /** Texto sem acento: `\b` em JS quebra em ç/ã e falsifica o match. */
  const t = stripAccents(raw.toLowerCase())

  const pedeLista =
    /\b(historico|extrato|movimentacao|lancamentos?)\b/i.test(t) ||
    /\bresumo\s+(financeiro\s+)?(do|da)\b/.test(t) ||
    (/\b(me\s+(mostra|manda|passa|envia)|mostre|mande)\b/.test(t) &&
      /\b(gastos?|despesas?|receitas?|transac[a-z]*|financeir[a-z]*)\b/.test(t)) ||
    /\b(quanto\s+(gastei|recebi))\b/.test(t)

  if (!pedeLista) return null

  /** Evita histórico genérico sem contexto financeiro (ex.: só a palavra "histórico"). */
  const temFinanceiro =
    /\b(gastos?|despesas?|receitas?|entradas?|saidas?|transac[a-z]*|financeir[a-z]*|historico|extrato|movimentacao|lancamentos?|quanto\s+(gastei|recebi))\b/i.test(
      t,
    )
  if (!temFinanceiro) return null

  let periodo = 'dia'
  if (/\b(semana|semanal)\b/.test(t)) periodo = 'semana'
  else if (/\b(mes|mensal|este\s+mes|nesse\s+mes|neste\s+mes)\b/.test(t)) periodo = 'mes'
  else if (/\b(hoje|do\s+dia|dia\s+de\s+hoje|neste\s+dia|no\s+dia)\b/.test(t)) periodo = 'dia'
  else if (
    /\b(historico|extrato|movimentacao|lancamentos?|quanto\s+(gastei|recebi))\b/.test(t) &&
    !/\b(semana|mes)\b/.test(t)
  ) {
    periodo = 'dia'
  }

  let tipo = 'ambos'
  const temReceita = /\breceitas?\b|\bentradas?\b/i.test(t)
  const temDespesa = /\bdespesas?\b|\bgastos?\b|\bsaidas?\b/i.test(t)
  if (temReceita && !temDespesa) tipo = 'RECEITA'
  else if (temDespesa && !temReceita) tipo = 'DESPESA'

  if (/\bquanto\s+gastei\b/i.test(t)) tipo = 'DESPESA'
  if (/\bquanto\s+recebi\b/i.test(t)) tipo = 'RECEITA'

  return { periodo, tipo }
}

export function boundsExtratoISO(periodo, now = new Date()) {
  if (periodo === 'semana') return boundsSemanaSP(now)
  if (periodo === 'mes') return boundsMesSP(now)
  return boundsDiaSP(now)
}

function fmtBrl(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDataCurta(iso) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, dateStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function nomeCategoria(row) {
  const c = row.categorias
  if (c && typeof c === 'object' && c.nome) return String(c.nome)
  return ''
}

/**
 * Busca transações EFETIVADAS no intervalo e devolve texto para WhatsApp.
 */
export async function montarRespostaExtratoWhatsApp(usuarioId, message) {
  const det = detectExtratoPedido(message)
  if (!det) return null

  const { dataInicio, dataFim, label } = boundsExtratoISO(det.periodo)
  const filters = {
    dataInicio,
    dataFim,
    status: 'EFETIVADA',
    limit: 80,
  }
  if (det.tipo !== 'ambos') filters.tipo = det.tipo

  const rows = await getTransacoes(usuarioId, filters)

  let receitas = 0
  let despesas = 0
  for (const r of rows) {
    const v = parseFloat(r.valor) || 0
    if (r.tipo === 'RECEITA') receitas += v
    else despesas += v
  }

  const periodoTitulo =
    det.periodo === 'dia' ? 'Hoje' : det.periodo === 'semana' ? 'Esta semana' : 'Este mês'

  let head = `📋 *${periodoTitulo}* (${label})\n\n`
  if (det.tipo === 'ambos') {
    head += `✅ Receitas: *${fmtBrl(receitas)}*\n❌ Despesas: *${fmtBrl(despesas)}*\n💰 Saldo no período: *${fmtBrl(receitas - despesas)}*`
  } else if (det.tipo === 'RECEITA') {
    head += `✅ Total receitas: *${fmtBrl(receitas)}*`
  } else {
    head += `❌ Total despesas: *${fmtBrl(despesas)}*`
  }

  if (!rows.length) {
    return `${head}\n\n_Nenhum lançamento neste período._`
  }

  const maxLinhas = 18
  const linhas = rows.slice(0, maxLinhas).map((r) => {
    const emoji = r.tipo === 'RECEITA' ? '✅' : '💸'
    const cat = nomeCategoria(r)
    const desc = String(r.descricao || '').trim() || cat || 'Sem descrição'
    const resto = cat && desc !== cat ? ` (${cat})` : ''
    return `${emoji} ${desc}${resto} — ${fmtBrl(parseFloat(r.valor) || 0)} — ${fmtDataCurta(r.data_transacao)}`
  })

  let body = `\n\n*Lançamentos:*\n${linhas.join('\n')}`
  if (rows.length > maxLinhas) {
    body += `\n\n_…e mais ${rows.length - maxLinhas} no app._`
  }

  return head + body
}

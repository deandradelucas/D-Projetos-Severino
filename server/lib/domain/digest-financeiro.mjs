import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { log } from '../logger.mjs'
import { sendEvolutionText } from '../evolution-send.mjs'

const MONTHS_FULL_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function normalizeBrazilWhatsAppNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return `55${digits}`
}

function formatBRL(v) {
  const n = Number(v) || 0
  return `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

function daysAgoIso(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().split('T')[0]
}

function lastWeekRange() {
  return { start: daysAgoIso(7), end: daysAgoIso(1) }
}

function prevWeekRange() {
  return { start: daysAgoIso(14), end: daysAgoIso(8) }
}

function lastMonthRange() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const end = new Date(Date.UTC(y, m, 0))    // último dia do mês passado
  const start = new Date(Date.UTC(y, m - 1, 1))
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    month: end.getUTCMonth(),
    year: end.getUTCFullYear(),
  }
}

function prevMonthRange() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const end = new Date(Date.UTC(y, m - 1, 0))
  const start = new Date(Date.UTC(y, m - 2, 1))
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

async function getResumoFinanceiro(usuarioId, dataInicio, dataFim) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('transacoes')
    .select('tipo, valor, categorias(nome)')
    .eq('usuario_id', usuarioId)
    .eq('status', 'EFETIVADA')
    .gte('data_transacao', dataInicio)
    .lte('data_transacao', dataFim)

  if (error) throw error

  let receitas = 0
  let despesas = 0
  const catMap = {}

  for (const tx of data || []) {
    const v = Number(tx.valor) || 0
    if (tx.tipo === 'RECEITA') {
      receitas += v
    } else if (tx.tipo === 'DESPESA') {
      despesas += v
      const cat = tx.categorias?.nome || 'Outros'
      catMap[cat] = (catMap[cat] || 0) + v
    }
  }

  const topCategorias = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([nome, valor]) => ({ nome, valor }))

  return { receitas, despesas, saldo: receitas - despesas, topCategorias, count: (data || []).length }
}

function buildComparativo(atual, anterior) {
  if (!anterior || anterior.despesas === 0) return ''
  const delta = ((atual.despesas - anterior.despesas) / anterior.despesas) * 100
  const abs = Math.abs(delta)
  if (abs < 2) return ''
  const dir = delta > 0 ? `⬆️ ${abs.toFixed(0)}% a mais` : `⬇️ ${abs.toFixed(0)}% a menos`
  return `\n📊 Despesas ${dir} que o período anterior`
}

function ddMm(iso) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function formatWeeklyMessage(semana, anterior, range) {
  let msg = `📊 *Resumo financeiro da semana*\nDe ${ddMm(range.start)} a ${ddMm(range.end)}`
  msg += `\n\n💰 Receitas: ${formatBRL(semana.receitas)}`
  msg += `\n💸 Despesas: ${formatBRL(semana.despesas)}`
  msg += `\n✅ Saldo: ${formatBRL(semana.saldo)}`

  if (semana.topCategorias.length > 0) {
    msg += '\n\n📂 Top categorias:\n'
    msg += semana.topCategorias.map(c => `• ${c.nome}: ${formatBRL(c.valor)}`).join('\n')
  }

  msg += buildComparativo(semana, anterior)
  return msg
}

function formatMonthlyMessage(mes, anterior, { month, year }) {
  const nomeMes = MONTHS_FULL_PT[month] ?? String(month + 1)
  let msg = `📅 *Fechamento de ${nomeMes}/${year}*`
  msg += `\n\n💰 Receitas: ${formatBRL(mes.receitas)}`
  msg += `\n💸 Despesas: ${formatBRL(mes.despesas)}`
  msg += `\n✅ Saldo: ${formatBRL(mes.saldo)}`

  if (mes.topCategorias.length > 0) {
    msg += '\n\n📂 Top categorias:\n'
    msg += mes.topCategorias.map(c => `• ${c.nome}: ${formatBRL(c.valor)}`).join('\n')
  }

  msg += buildComparativo(mes, anterior)
  return msg
}

export async function processDigestBatch({ tipo = 'semanal', limit = 500 } = {}) {
  const supabase = getSupabaseAdmin()

  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, nome, telefone, whatsapp_id')
    .limit(Math.min(Math.max(Number(limit) || 500, 1), 500))

  if (error) throw error

  const sent = []
  const skipped = []
  const failed = []

  for (const usuario of usuarios || []) {
    const phone = normalizeBrazilWhatsAppNumber(usuario.whatsapp_id) || normalizeBrazilWhatsAppNumber(usuario.telefone)
    if (!phone) {
      skipped.push(usuario.id)
      continue
    }

    try {
      let message
      let hasActivity

      if (tipo === 'semanal') {
        const range = lastWeekRange()
        const prevRange = prevWeekRange()
        const [semana, anterior] = await Promise.all([
          getResumoFinanceiro(usuario.id, range.start, range.end),
          getResumoFinanceiro(usuario.id, prevRange.start, prevRange.end),
        ])
        hasActivity = semana.count > 0
        message = formatWeeklyMessage(semana, anterior, range)
      } else {
        const range = lastMonthRange()
        const prevRange = prevMonthRange()
        const [mes, anterior] = await Promise.all([
          getResumoFinanceiro(usuario.id, range.start, range.end),
          getResumoFinanceiro(usuario.id, prevRange.start, prevRange.end),
        ])
        hasActivity = mes.count > 0
        message = formatMonthlyMessage(mes, anterior, { month: range.month, year: range.year })
      }

      if (!hasActivity) {
        skipped.push(usuario.id)
        continue
      }

      const ok = await sendEvolutionText({
        instance: process.env.EVOLUTION_INSTANCE,
        number: phone,
        text: message,
      })

      if (ok) {
        sent.push(usuario.id)
      } else {
        failed.push({ id: usuario.id, error: 'Evolution retornou false' })
      }
    } catch (err) {
      log.error('[digest] erro ao processar usuário', { id: usuario.id, error: err?.message || err })
      failed.push({ id: usuario.id, error: err?.message || 'Erro desconhecido' })
    }
  }

  return {
    ok: failed.length === 0,
    tipo,
    total: (usuarios || []).length,
    sent: sent.length,
    skipped: skipped.length,
    failed: failed.length,
    failures: failed.slice(0, 5),
  }
}

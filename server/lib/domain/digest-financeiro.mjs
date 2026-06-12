import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { log } from '../logger.mjs'
import { sendEvolutionText } from '../evolution-send.mjs'
import { groqChatCompletion } from '../ai/groq-client.mjs'

/**
 * Gera UM insight personalizado do Severino IA para o digest (tom caloroso+direto).
 * Usa Groq (rápido, quota separada do Gemini) — só para usuários com atividade.
 * Best-effort: retorna '' se indisponível, então o digest sai só com o template.
 */
async function gerarInsightDigest(resumo, anterior, tipo, nome) {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey || !resumo) return ''
  try {
    const periodo = tipo === 'semanal' ? 'esta semana' : 'este mês'
    const topCat = resumo.topCategorias?.[0]
    const deltaPct = anterior && anterior.despesas > 0
      ? Math.round(((resumo.despesas - anterior.despesas) / anterior.despesas) * 100)
      : null
    const dados = [
      `período: ${periodo}`,
      `receitas: ${formatBRL(resumo.receitas)}`,
      `despesas: ${formatBRL(resumo.despesas)}`,
      `saldo: ${formatBRL(resumo.saldo)}`,
      topCat ? `categoria que mais pesou: ${topCat.nome} (${formatBRL(topCat.valor)})` : '',
      deltaPct !== null ? `despesas variaram ${deltaPct}% vs o período anterior` : '',
    ].filter(Boolean).join('; ')
    const systemPrompt =
      'Você é o Severino, assistente financeiro pessoal brasileiro. Escreva UMA frase curta (máx. 2 linhas) comentando o resumo, no tom CALOROSO e DIRETO. ' +
      'Se o saldo foi POSITIVO ou as despesas caíram, COMEMORE de forma genuína e só então, se couber, dê um incentivo leve (sem cobrar corte). ' +
      'Se o saldo foi NEGATIVO ou as despesas subiram muito, aponte com gentileza e sugira UM ajuste concreto. ' +
      'Use o nome da pessoa quando fornecido. NÃO repita todos os números (eles já aparecem na mensagem) — foque no que importa. No máximo 1 emoji. Sem saudação inicial.'
    const text = await groqChatCompletion({
      apiKey: groqKey,
      systemPrompt,
      userMessage: `${nome ? `Nome: ${nome}. ` : ''}Resumo: ${dados}`,
      maxTokens: 120,
      temperature: 0.6,
    })
    const insight = String(text || '').trim().replace(/^["'`]|["'`]$/g, '').trim()
    return insight ? `\n\n💡 ${insight}` : ''
  } catch {
    return ''
  }
}

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

function dayAfterIso(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
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
    .lt('data_transacao', dayAfterIso(dataFim))

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

  // Idempotência: coluna e janela do período corrente (retry n8n não reenvia).
  const colControle = tipo === 'semanal' ? 'digest_semanal_em' : 'digest_mensal_em'
  const janelaMs = (tipo === 'semanal' ? 6 : 27) * 24 * 3600000
  const corteEnvio = Date.now() - janelaMs

  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select(`id, nome, telefone, whatsapp_id, vinculo_conta_principal_id, ${colControle}`)
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

    // Já recebeu este digest no período corrente → não reenvia.
    if (usuario[colControle] && new Date(usuario[colControle]).getTime() > corteEnvio) {
      skipped.push(usuario.id)
      continue
    }

    try {
      // Membros de conta familiar usam os dados financeiros do titular
      const dataUserId = usuario.vinculo_conta_principal_id || usuario.id

      let message
      let hasActivity
      let resumoFinal = null
      let anteriorFinal = null

      if (tipo === 'semanal') {
        const range = lastWeekRange()
        const prevRange = prevWeekRange()
        const [semana, anterior] = await Promise.all([
          getResumoFinanceiro(dataUserId, range.start, range.end),
          getResumoFinanceiro(dataUserId, prevRange.start, prevRange.end),
        ])
        hasActivity = semana.count > 0
        message = formatWeeklyMessage(semana, anterior, range)
        resumoFinal = semana
        anteriorFinal = anterior
      } else {
        const range = lastMonthRange()
        const prevRange = prevMonthRange()
        const [mes, anterior] = await Promise.all([
          getResumoFinanceiro(dataUserId, range.start, range.end),
          getResumoFinanceiro(dataUserId, prevRange.start, prevRange.end),
        ])
        hasActivity = mes.count > 0
        message = formatMonthlyMessage(mes, anterior, { month: range.month, year: range.year })
        resumoFinal = mes
        anteriorFinal = anterior
      }

      if (!hasActivity) {
        skipped.push(usuario.id)
        continue
      }

      // Severino IA proativo: insight personalizado ao final do digest (só quem teve atividade)
      message += await gerarInsightDigest(resumoFinal, anteriorFinal, tipo, usuario.nome)

      const ok = await sendEvolutionText({
        instance: process.env.EVOLUTION_INSTANCE,
        number: phone,
        text: message,
      })

      if (ok) {
        sent.push(usuario.id)
        // Marca SÓ após envio bem-sucedido (idempotência do período).
        const { error: upErr } = await supabase
          .from('usuarios').update({ [colControle]: new Date().toISOString() }).eq('id', usuario.id)
        if (upErr) log.warn('[digest] falha ao marcar envio', { id: usuario.id, error: upErr.message })
      } else {
        failed.push({ id: usuario.id, error: 'Evolution retornou false' })
      }
      // Throttle: com 300+ usuários, envios em rajada estouram o rate limit da
      // Evolution e as últimas mensagens falham. 150ms entre envios segura o ritmo.
      await new Promise((r) => setTimeout(r, 150))
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

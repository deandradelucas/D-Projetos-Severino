import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { sendEvolutionText } from './evolution-send.mjs'

const STATUS_APROVADOS = new Set(['approved', 'authorized', 'accredited', 'received', 'confirmed'])

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function mesesDesde(dateStr) {
  if (!dateStr) return null
  const inicio = new Date(dateStr)
  if (isNaN(inicio.getTime())) return null
  const agora = new Date()
  const m = (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth())
  return Math.max(0, m)
}

async function buscarUsuariosComRenovacaoEmDias(daysAhead) {
  const supabase = getSupabaseAdmin()
  const alvo = new Date()
  alvo.setDate(alvo.getDate() + daysAhead)
  const diaAlvo = alvo.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, usuario, telefone, whatsapp_id, assinatura_proxima_cobranca, criado_em, created_at')
    .eq('assinatura_paga', true)
    .eq('assinatura_situacao', 'ativo')
    .or('isento_pagamento.is.null,isento_pagamento.eq.false')
    .gte('assinatura_proxima_cobranca', `${diaAlvo}T00:00:00`)
    .lte('assinatura_proxima_cobranca', `${diaAlvo}T23:59:59`)

  if (error) {
    log.warn('[extrato-renovacao] erro ao buscar usuários', error.message)
    return []
  }

  return (data || []).filter((u) => {
    const phone = String(u.whatsapp_id || u.telefone || '').replace(/\D/g, '')
    return phone.length >= 10
  })
}

async function buscarEstatisticasPagamento(usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('pagamentos_asaas')
    .select('amount, status, created_at')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: true })

  if (error || !data) return { totalInvestido: 0, qtdPagamentos: 0, primeiroPagamentoEm: null }

  const aprovados = data.filter((r) => STATUS_APROVADOS.has(String(r.status || '').toLowerCase()))
  const totalInvestido = aprovados.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

  return {
    totalInvestido,
    qtdPagamentos: aprovados.length,
    primeiroPagamentoEm: aprovados.length > 0 ? aprovados[0].created_at : null,
  }
}

function buildExtratoMensagem(usuario, stats, daysAhead) {
  const primeiroNome = String(usuario.nome || usuario.usuario || '').split(' ')[0].trim() || 'você'
  const dataRenovacao = formatDateBR(usuario.assinatura_proxima_cobranca)
  const meses = mesesDesde(stats.primeiroPagamentoEm ?? usuario.criado_em ?? usuario.created_at)

  const linhaJornada =
    meses != null && meses > 0
      ? `🗓️ ${meses} ${meses === 1 ? 'mês' : 'meses'} investindo em você`
      : '🗓️ Sua jornada está começando'

  const linhaTotal =
    stats.totalInvestido > 0
      ? `💰 Total investido: *${formatBRL(stats.totalInvestido)}*`
      : null

  const diasTexto = daysAhead === 1 ? 'amanhã' : `em ${daysAhead} dias`

  const partes = [
    `📊 *Severino — Extrato de renovação*`,
    ``,
    `Olá, *${primeiroNome}*! 👋`,
    ``,
    `Seu plano renova *${diasTexto}* (${dataRenovacao}).`,
    ``,
    `───────────────`,
    linhaJornada,
    linhaTotal,
    `───────────────`,
    ``,
    `Esse investimento é em você. Continue. 💪`,
    ``,
    `Dúvidas? Responda aqui.`,
  ]

  return partes.filter((l) => l !== null).join('\n')
}

/**
 * Busca usuários com renovação em `daysAhead` dias e envia extrato via WhatsApp.
 * Chamado pelo endpoint GET /api/cron/extrato-renovacao.
 */
export async function processExtratoRenovacaoCron({ daysAhead = 3 } = {}) {
  if (!process.env.EVOLUTION_INSTANCE) {
    log.warn('[extrato-renovacao] EVOLUTION_INSTANCE não configurado — pulando')
    return { ok: false, skipped: true, reason: 'evolution_not_configured' }
  }

  const usuarios = await buscarUsuariosComRenovacaoEmDias(daysAhead)
  log.info(`[extrato-renovacao] ${usuarios.length} usuário(s) com renovação em ${daysAhead} dia(s)`)

  const sent = []
  const failed = []

  for (const usuario of usuarios) {
    try {
      const stats = await buscarEstatisticasPagamento(usuario.id)
      const mensagem = buildExtratoMensagem(usuario, stats, daysAhead)
      const phone = String(usuario.whatsapp_id || usuario.telefone || '').replace(/\D/g, '')

      const ok = await sendEvolutionText({
        instance: process.env.EVOLUTION_INSTANCE,
        number: phone,
        text: mensagem,
      })

      if (ok) {
        sent.push(usuario.id)
        log.info(`[extrato-renovacao] enviado uid=${usuario.id}`)
      } else {
        failed.push({ id: usuario.id, error: 'Evolution retornou falso' })
        log.warn(`[extrato-renovacao] falha ao enviar uid=${usuario.id}`)
      }
    } catch (err) {
      log.error(`[extrato-renovacao] erro uid=${usuario.id}`, err?.message || err)
      failed.push({ id: usuario.id, error: err?.message || 'Erro desconhecido' })
    }
  }

  return {
    ok: failed.length === 0,
    total: usuarios.length,
    sent: sent.length,
    failed: failed.length,
    failures: failed.slice(0, 5),
  }
}

import { getSupabaseAdmin } from './supabase-admin.mjs'
import { log } from './logger.mjs'
import { sendEvolutionText } from './evolution-send.mjs'
import { computeAssinaturaFlags } from './assinatura-flags.mjs'

function primeiroNome(usuario) {
  return usuario.nome ? usuario.nome.split(' ')[0] : null
}

function filtraComPhone(rows) {
  return (rows || []).filter((u) => {
    const phone = String(u.whatsapp_id || u.telefone || '').replace(/\D/g, '')
    return phone.length >= 10
  })
}

function buildMsgReengajamento(u) {
  const nome = primeiroNome(u)
  const saudacao = nome ? `Oi *${nome}*,` : 'Oi,'
  return (
    `🔔 ${saudacao} tudo bem?\n\n` +
    `Faz 2 dias que você não registra nada no Severino. Que que houve?\n\n` +
    `Perdeu alguma compra no caminho? 💸\n` +
    `Recebeu algum pagamento? 💰\n` +
    `Tem algo pra botar na agenda essa semana? 📅\n\n` +
    `Me conta tudo! É só mandar uma mensagem:\n` +
    `_"gastei 35 no almoço"_\n` +
    `_"recebi 500 de freela"_\n` +
    `_"dentista terça 10h"_\n\n` +
    `Controlar as finanças é fácil quando vira hábito. 💡`
  )
}

async function enviar(usuario, mensagem) {
  const phone = String(usuario.whatsapp_id || usuario.telefone || '').replace(/\D/g, '')
  try {
    await sendEvolutionText({
      instance: process.env.EVOLUTION_INSTANCE,
      number: phone,
      text: mensagem,
    })
    // Marca o envio (idempotência: skip se já enviado nas últimas 72h).
    const { error } = await getSupabaseAdmin()
      .from('usuarios').update({ reengajamento_em: new Date().toISOString() }).eq('id', usuario.id)
    if (error) log.warn('[reengajamento] falha ao marcar envio', { userId: usuario.id, error: error.message })
    log.info('[reengajamento] enviado', { userId: usuario.id, phone })
    return true
  } catch (e) {
    log.warn('[reengajamento] falha ao enviar', { userId: usuario.id, error: e?.message })
    return false
  }
}

export async function processarReengajamentoCron() {
  if (!process.env.EVOLUTION_INSTANCE) {
    return { ok: false, motivo: 'EVOLUTION_INSTANCE ausente' }
  }

  const supabase = getSupabaseAdmin()
  const now = Date.now()
  const cutoff48h = new Date(now - 48 * 3600000).toISOString()
  const cutoff72h = new Date(now - 72 * 3600000).toISOString()

  // Usuários com atividade na janela 48h–72h (última transação = 2 dias atrás)
  const { data: transacoesJanela, error: errJanela } = await supabase
    .from('transacoes')
    .select('usuario_id')
    .gte('criado_em', cutoff72h)
    .lt('criado_em', cutoff48h)
  if (errJanela) {
    log.warn('[reengajamento] query janela error', errJanela.message)
    return { ok: false, motivo: errJanela.message }
  }

  const idsNaJanela = [...new Set((transacoesJanela || []).map((t) => t.usuario_id))]
  if (idsNaJanela.length === 0) {
    return { ok: true, enviados: 0, erros: 0, detalhes: { candidatos: 0 } }
  }

  // Excluir quem teve atividade nas últimas 48h (voltaram a usar)
  const { data: transacoesRecentes } = await supabase
    .from('transacoes')
    .select('usuario_id')
    .gte('criado_em', cutoff48h)
    .in('usuario_id', idsNaJanela)
  const idsRecentes = new Set((transacoesRecentes || []).map((t) => t.usuario_id))

  const candidatos = idsNaJanela.filter((id) => !idsRecentes.has(id))
  if (candidatos.length === 0) {
    return { ok: true, enviados: 0, erros: 0, detalhes: { candidatos: 0 } }
  }

  // Buscar dados dos candidatos e checar acesso
  const { data: usuarios, error: errUsers } = await supabase
    .from('usuarios')
    .select('id, nome, whatsapp_id, telefone, email, isento_pagamento, trial_ends_at, assinatura_paga, assinatura_asaas_status, reengajamento_em')
    .in('id', candidatos)
  if (errUsers) {
    log.warn('[reengajamento] query usuarios error', errUsers.message)
    return { ok: false, motivo: errUsers.message }
  }

  // Filtra: tem acesso + tem telefone + não recebeu reengajamento nas últimas 72h
  const corte72h = now - 72 * 3600000
  const elegíveis = filtraComPhone(
    (usuarios || []).filter((u) => {
      const flags = computeAssinaturaFlags(u)
      if (!flags.acesso_app_liberado) return false
      if (u.reengajamento_em && new Date(u.reengajamento_em).getTime() > corte72h) return false // idempotência
      return true
    })
  )

  let enviados = 0
  let erros = 0
  for (const u of elegíveis) {
    ;(await enviar(u, buildMsgReengajamento(u))) ? enviados++ : erros++
  }

  log.info('[reengajamento] cron concluído', { enviados, erros, candidatos: elegíveis.length })
  return { ok: true, enviados, erros, detalhes: { candidatos: elegíveis.length } }
}

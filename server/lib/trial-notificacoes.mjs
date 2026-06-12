import { getSupabaseAdmin } from './supabase-admin.mjs'
import { log } from './logger.mjs'
import { sendEvolutionText } from './evolution-send.mjs'

const LINK_PAGAMENTO = process.env.APP_URL
  ? `${process.env.APP_URL}/pagamento`
  : 'https://severino.mestredamente.com/pagamento'

function fmtData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

function primeiroNome(usuario) {
  return usuario.nome ? usuario.nome.split(' ')[0] : 'você'
}

async function buscarTrialNaJanela(inicioHoras, fimHoras, colControle) {
  const supabase = getSupabaseAdmin()
  const now = Date.now()
  const inicio = new Date(now + inicioHoras * 3600000).toISOString()
  const fim = new Date(now + fimHoras * 3600000).toISOString()

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, whatsapp_id, telefone, trial_ends_at')
    .gte('trial_ends_at', inicio)
    .lt('trial_ends_at', fim)
    .is('assinatura_asaas_status', null)
    .not('isento_pagamento', 'eq', true)
    // Idempotência: só quem ainda não recebeu esta etapa (retry n8n não duplica).
    .is(colControle, null)

  if (error) {
    // Não engolir o erro: retornar [] silencioso fazia o cron reportar
    // "ok, 0 enviados" mesmo com o banco fora — ninguém recebia e ninguém via.
    log.error('[trial-notificacoes] query janela error', error.message)
    throw new Error(`trial janela query: ${error.message}`)
  }
  return filtraComPhone(data)
}

async function buscarTrialExpirado() {
  const supabase = getSupabaseAdmin()
  const now = new Date()
  const seteDiasAtras = new Date(now.getTime() - 7 * 24 * 3600000).toISOString()

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, whatsapp_id, telefone, trial_ends_at')
    .lt('trial_ends_at', now.toISOString())
    .gte('trial_ends_at', seteDiasAtras)
    .is('assinatura_asaas_status', null)
    .not('isento_pagamento', 'eq', true)
    .is('notif_trial_expirado_em', null) // idempotência

  if (error) {
    log.error('[trial-notificacoes] query expirado error', error.message)
    throw new Error(`trial expirado query: ${error.message}`)
  }
  return filtraComPhone(data)
}

function filtraComPhone(rows) {
  return (rows || []).filter((u) => {
    const phone = String(u.whatsapp_id || u.telefone || '').replace(/\D/g, '')
    return phone.length >= 10
  })
}

function buildMsg3Dias(u) {
  const nome = primeiroNome(u)
  const data = fmtData(u.trial_ends_at)
  return (
    `⏳ *Faltam 3 dias no seu teste, ${nome}!*\n\n` +
    `Você está usando o Severino para controlar suas finanças — e está funcionando!\n\n` +
    `Para não perder o acesso no dia ${data}, assine agora:\n` +
    `👉 ${LINK_PAGAMENTO}\n\n` +
    `_Menos de R$ 1/dia. Cancele quando quiser._ 🎯`
  )
}

function buildMsg1Dia(u) {
  const nome = primeiroNome(u)
  return (
    `⚠️ *Último dia do seu teste, ${nome}!*\n\n` +
    `Amanhã o acesso pelo WhatsApp será encerrado.\n\n` +
    `Assine agora e continue de onde parou — tudo que você já registrou fica salvo:\n` +
    `👉 ${LINK_PAGAMENTO}\n\n` +
    `_É rápido, fácil e menos de R$ 1/dia._ 💰`
  )
}

function buildMsgExpirado(u) {
  const nome = primeiroNome(u)
  return (
    `😔 *Seu teste do Severino encerrou, ${nome}.*\n\n` +
    `Suas finanças ficaram salvas e estão esperando você voltar.\n\n` +
    `Assine agora e retome o controle financeiro da família:\n` +
    `👉 ${LINK_PAGAMENTO}\n\n` +
    `_Menos de R$ 1/dia. Sem fidelidade._ 🙌`
  )
}

async function enviar(usuario, mensagem, colControle) {
  const phone = String(usuario.whatsapp_id || usuario.telefone || '').replace(/\D/g, '')
  try {
    await sendEvolutionText({
      instance: process.env.EVOLUTION_INSTANCE,
      number: phone,
      text: mensagem,
    })
    // Marca o envio SÓ após sucesso — assim o filtro .is(col,null) bloqueia
    // reenvio numa próxima execução. Se a marcação falhar, loga (no pior caso
    // o usuário recebe de novo, mas nunca deixa de receber).
    const { error } = await getSupabaseAdmin()
      .from('usuarios').update({ [colControle]: new Date().toISOString() }).eq('id', usuario.id)
    if (error) log.warn('[trial-notificacoes] falha ao marcar envio', { userId: usuario.id, col: colControle, error: error.message })
    log.info('[trial-notificacoes] enviado', { userId: usuario.id, phone })
    return true
  } catch (e) {
    log.warn('[trial-notificacoes] falha ao enviar', { userId: usuario.id, error: e?.message })
    return false
  }
}

export async function processarTrialNotificacoesCron() {
  if (!process.env.EVOLUTION_INSTANCE) {
    return { ok: false, motivo: 'EVOLUTION_INSTANCE ausente' }
  }

  let enviados = 0
  let erros = 0

  // T-3 dias — janela de ±6h em torno da marca de 72h
  const lista3Dias = await buscarTrialNaJanela(66, 78, 'notif_trial_3d_em')
  for (const u of lista3Dias) {
    ;(await enviar(u, buildMsg3Dias(u), 'notif_trial_3d_em')) ? enviados++ : erros++
  }

  // T-1 dia — janela de ±6h em torno da marca de 24h
  const lista1Dia = await buscarTrialNaJanela(18, 30, 'notif_trial_1d_em')
  for (const u of lista1Dia) {
    ;(await enviar(u, buildMsg1Dia(u), 'notif_trial_1d_em')) ? enviados++ : erros++
  }

  // Expirado — últimos 7 dias sem assinar
  const listaExpirados = await buscarTrialExpirado()
  for (const u of listaExpirados) {
    ;(await enviar(u, buildMsgExpirado(u), 'notif_trial_expirado_em')) ? enviados++ : erros++
  }

  log.info('[trial-notificacoes] cron concluído', { enviados, erros })
  return {
    ok: true,
    enviados,
    erros,
    detalhes: {
      t3dias: lista3Dias.length,
      t1dia: lista1Dia.length,
      expirados: listaExpirados.length,
    },
  }
}

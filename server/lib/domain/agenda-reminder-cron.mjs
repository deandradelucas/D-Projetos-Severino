import { log } from '../logger.mjs'
import { sendEvolutionText } from '../evolution-send.mjs'
import {
  claimLembreteAgenda,
  listarEMarcarLembretesPendentes,
  registrarFalhaLembreteAgenda,
  registrarLembretesAgendaEnviados,
} from './agenda.mjs'

/** Remove sufixo legado ou injetado por automação (ex.: "Responda: confirmar …"). */
function stripRespondaAgendaReminderSuffix(text) {
  if (!text || typeof text !== 'string') return text
  return text.replace(/\s*Responda\s*:\s*[\s\S]*$/i, '').trimEnd()
}

export async function processAgendaReminderCron({ limit = 80 } = {}) {
  const result = await listarEMarcarLembretesPendentes({ limit, marcarComoEnviado: false })
  const mensagens = Array.isArray(result?.mensagens) ? result.mensagens : []
  const sent = []
  const failed = []

  for (const item of mensagens) {
    const claimed = await claimLembreteAgenda(item)
    if (!claimed) continue

    try {
      const okText = await sendEvolutionText({
        instance: process.env.EVOLUTION_INSTANCE,
        number: item.phone,
        text: stripRespondaAgendaReminderSuffix(item.message),
      })
      if (!okText) throw new Error('Evolution sendText falhou.')
      await registrarLembretesAgendaEnviados([item])
      sent.push(item.reminder_id)
    } catch (error) {
      await registrarFalhaLembreteAgenda(item, error?.message || 'Falha ao enviar lembrete.')
      failed.push({ reminder_id: item.reminder_id, error: error?.message || 'Falha ao enviar lembrete.' })
      log.error('[agenda-cron] send reminder failed', {
        reminder_id: item.reminder_id,
        event_id: item.event_id,
        user_id: item.user_id,
        error: error?.message || error,
      })
    }
  }

  return {
    ok: failed.length === 0,
    total: mensagens.length,
    sent: sent.length,
    failed: failed.length,
    failures: failed.slice(0, 5),
  }
}

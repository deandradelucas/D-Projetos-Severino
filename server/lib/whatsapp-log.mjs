import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'

export async function registrarLogWhatsApp(telefone, mensagem, status, detalhe, usuarioId = null) {
  const supabaseAdmin = getSupabaseAdmin()

  try {
    const { error } = await supabaseAdmin.from('whatsapp_logs').insert({
      telefone_remetente: telefone,
      mensagem_recebida: mensagem,
      status: status,
      detalhe_erro: detalhe,
      usuario_id: usuarioId,
    })

    if (error) {
      log.error('[DB Log Error] falha ao salvar log do zap:', error)
    }
  } catch (err) {
    log.error('[DB Log Panic] erro inesperado ao salvar log:', err)
  }
}

export async function getWhatsappLogs(limit = 200) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('whatsapp_logs')
    .select('*, usuarios(email, nome)')
    .order('data_hora', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function getWhatsappStatus() {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error, count } = await supabaseAdmin
    .from('whatsapp_logs')
    .select('data_hora', { count: 'exact' })
    .order('data_hora', { ascending: false })
    .limit(1)

  if (error) throw error

  const lastPulse = data && data.length > 0 ? data[0].data_hora : null
  const ONLINE_WINDOW_MS = 30 * 60 * 1000 // 30 minutos sem atividade = offline
  const online = lastPulse ? Date.now() - new Date(lastPulse).getTime() < ONLINE_WINDOW_MS : false

  return {
    platform: 'Evolution API',
    totalLogs: count || 0,
    lastPulse,
    online,
  }
}

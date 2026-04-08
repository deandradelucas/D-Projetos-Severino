import { getSupabaseAdmin } from './supabase-admin.mjs'

export async function atualizarTelefoneUsuario(usuarioId, telefoneLimpo) {
  const supabaseAdmin = getSupabaseAdmin()
  
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update({ telefone: telefoneLimpo })
    .eq('id', usuarioId)
    .select('id, telefone')
    .single()

  if (error) {
    if (error.code === '23505') { // unique violation
      throw new Error('Este telefone já está cadastrado em outra conta.')
    }
    throw error
  }

  return data
}

export async function buscarUsuarioPorTelefone(telefoneLimpo) {
  const supabaseAdmin = getSupabaseAdmin()
  
  // Tentar busca exata primeiro
  let { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, email, telefone')
    .eq('telefone', telefoneLimpo)
    .maybeSingle()

  // Se não achou e o número tem 12 ou 13 dígitos (com 55), tenta buscar sem o 55
  if (!data && (telefoneLimpo.startsWith('55') && telefoneLimpo.length >= 12)) {
    const semDDI = telefoneLimpo.substring(2)
    const { data: dataSemDDI } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, telefone')
      .eq('telefone', semDDI)
      .maybeSingle()
    
    if (dataSemDDI) data = dataSemDDI
  }

  // Se ainda não achou, tenta uma busca mais "agressiva" limpando caracteres do banco (caso existam (, ), -, etc)
  if (!error && !data) {
    const { data: allUsers } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, telefone')
      .not('telefone', 'is', null)

    if (allUsers) {
      const target = telefoneLimpo.startsWith('55') ? telefoneLimpo.substring(2) : telefoneLimpo
      data = allUsers.find(u => {
        const uClean = u.telefone.replace(/\D/g, '')
        return uClean === target || uClean === telefoneLimpo
      }) || null
    }
  }

  return data
}

export async function getPerfilUsuario(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, email, telefone')
    .eq('id', usuarioId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

export async function registrarLogWhatsApp(telefone, mensagem, status, detalhe, usuarioId = null) {
  const supabaseAdmin = getSupabaseAdmin()
  
  try {
    const { error } = await supabaseAdmin.from('whatsapp_logs').insert({
      telefone_remetente: telefone,
      mensagem_recebida: mensagem,
      status: status,
      detalhe_erro: detalhe,
      usuario_id: usuarioId
    })
    
    if (error) {
      console.error('[DB Log Error] falha ao salvar log do zap:', error)
    }
  } catch (err) {
    console.error('[DB Log Panic] erro inesperado ao salvar log:', err)
  }
}

export async function getWhatsappLogs(limit = 50) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('whatsapp_logs')
    .select('*')
    .order('data_hora', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function getWhatsappStatus() {
  const supabaseAdmin = getSupabaseAdmin()
  
  // Buscar contagem total e última data
  const { data, error, count } = await supabaseAdmin
    .from('whatsapp_logs')
    .select('data_hora', { count: 'exact' })
    .order('data_hora', { ascending: false })
    .limit(1)

  if (error) throw error

  return {
    platform: 'Chipmassa / Telein',
    totalLogs: count || 0,
    lastPulse: data && data.length > 0 ? data[0].data_hora : null,
    online: true // Se chegamos aqui, a conexão com o banco/API está ok
  }
}


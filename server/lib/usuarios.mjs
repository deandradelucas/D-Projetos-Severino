import { getSupabaseAdmin } from './supabase-admin.mjs'
import { resolverUsuarioIdPorTelefoneGemini } from './ai.mjs'

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

/**
 * Gera variantes com/sem DDI 55 para bater com o cadastro (ex.: 11999... vs 5511999...).
 * Inclui truncamento dos primeiros 11/13 dígitos (LID/@lid costuma vir com dígito extra).
 */
export function variantesTelefoneBrasil(digitos) {
  const d = String(digitos || '').replace(/\D/g, '')
  if (!d) return []
  const out = new Set([d])

  if (d.startsWith('55') && d.length > 2) {
    out.add(d.slice(2))
  }
  if (!d.startsWith('55') && d.length >= 10 && d.length <= 15) {
    out.add(`55${d}`)
  }
  // Nacional 11 dígitos (DDD + celular) — primeiro bloco quando vem lixo no fim (ex.: LID 14+ dígitos)
  if (d.length > 11) {
    const head11 = d.slice(0, 11)
    out.add(head11)
    if (!d.startsWith('55')) out.add(`55${head11}`)
  }
  if (d.length > 13 && d.startsWith('55')) {
    out.add(d.slice(0, 13))
    out.add(d.slice(2, 13))
  }
  // Últimos 11 dígitos (DDD + celular)
  if (d.length >= 11) {
    const tail11 = d.slice(-11)
    out.add(tail11)
    out.add(`55${tail11}`)
  }
  if (d.length >= 13 && d.startsWith('55')) {
    const after55 = d.slice(2)
    if (after55.length >= 11) {
      out.add(after55.slice(-11))
    }
  }

  return [...out]
}

/** Quando só um usuário tem telefone que “casa” pelo sufixo (9–13 dígitos). */
function buscarUsuarioPorSufixoUnico(digitos, allUsers) {
  const d = String(digitos).replace(/\D/g, '')
  if (d.length < 8 || !allUsers?.length) return null

  for (const len of [13, 12, 11, 10, 9]) {
    if (d.length < len) continue
    const suf = d.slice(-len)
    const matches = allUsers.filter((u) => {
      const uc = String(u.telefone).replace(/\D/g, '')
      return uc === suf || uc.endsWith(suf) || suf.endsWith(uc)
    })
    if (matches.length === 1) return matches[0]
  }

  if (d.length >= 11) {
    const pre11 = d.slice(0, 11)
    const matches = allUsers.filter((u) => {
      const uc = String(u.telefone).replace(/\D/g, '')
      const nacional = uc.startsWith('55') ? uc.slice(2) : uc
      return nacional.slice(0, 11) === pre11 || nacional === pre11
    })
    if (matches.length === 1) return matches[0]
  }

  return null
}

/**
 * @param {string} telefoneLimpo
 * @param {{ usarGemini?: boolean }} [options] — default usarGemini true se GEMINI_API_KEY existir
 */
export async function buscarUsuarioPorTelefone(telefoneLimpo, options = {}) {
  const supabaseAdmin = getSupabaseAdmin()
  const variants = variantesTelefoneBrasil(telefoneLimpo)

  for (const v of variants) {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, telefone')
      .eq('telefone', v)
      .maybeSingle()

    if (error) break
    if (data) return data
  }

  const { data: allUsers, error: errAll } = await supabaseAdmin
    .from('usuarios')
    .select('id, email, telefone')
    .not('telefone', 'is', null)

  if (errAll || !allUsers?.length) return null

  const targetVariants = new Set(variantesTelefoneBrasil(telefoneLimpo))

  const found = allUsers.find((u) => {
    const uClean = String(u.telefone).replace(/\D/g, '')
    if (targetVariants.has(uClean)) return true
    const uVars = new Set(variantesTelefoneBrasil(uClean))
    for (const t of targetVariants) {
      if (uVars.has(t)) return true
    }
    return false
  })
  if (found) return found

  const bySuffix = buscarUsuarioPorSufixoUnico(telefoneLimpo, allUsers)
  if (bySuffix) return bySuffix

  const usarGemini = options.usarGemini !== false
  if (usarGemini) {
    const geminiMatch = await resolverUsuarioIdPorTelefoneGemini(telefoneLimpo, allUsers)
    if (geminiMatch) return geminiMatch
  }

  return null
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

/** Lista usuários para painel admin (telefone WhatsApp visível). */
export async function listUsuariosAdmin() {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, email, telefone')
    .order('email', { ascending: true })

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


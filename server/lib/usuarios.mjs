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
 * Celular BR completo: 55 + DDD(2) + 9 dígitos = 13 caracteres.
 * Nunca aplicar slice(0,11) nesse formato — virava 55549969944 e sumia dígito (ex.: 54996994482).
 */
export function normalizarDigitosWhatsappLog(digitos) {
  const d = String(digitos || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('55') && d.length === 13) return d
  if (!d.startsWith('55') && d.length === 11 && /^\d{2}9\d{8}$/.test(d)) return `55${d}`
  if (d.startsWith('55') && d.length > 13) return d.slice(0, 13)
  return d
}

/**
 * Gera variantes com/sem DDI 55 para bater com o cadastro (ex.: 11999... vs 5511999...).
 * LID longo: truncar só quando não for E.164 BR 13 dígitos.
 */
export function variantesTelefoneBrasil(digitos) {
  const d = String(digitos || '').replace(/\D/g, '')
  if (!d) return []
  const out = new Set([d])

  const isE164Br13 = d.startsWith('55') && d.length === 13
  const nacional13 = isE164Br13 ? d.slice(2) : ''

  if (isE164Br13) {
    out.add(nacional13)
  } else if (d.startsWith('55') && d.length > 2) {
    out.add(d.slice(2))
  }

  if (!d.startsWith('55') && d.length >= 10 && d.length <= 15) {
    out.add(`55${d}`)
  }

  if (d.startsWith('55') && d.length > 13) {
    const core = d.slice(0, 13)
    out.add(core)
    out.add(core.slice(2))
  } else if (!d.startsWith('55') && d.length > 11) {
    const h11 = d.slice(0, 11)
    out.add(h11)
    out.add(`55${h11}`)
  }

  if (d.length >= 11) {
    const t11 = d.slice(-11)
    out.add(t11)
    out.add(`55${t11}`)
  }

  if (!isE164Br13 && d.startsWith('55') && d.length >= 13) {
    const after55 = d.slice(2)
    if (after55.length > 11) {
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
    .select('id, email, telefone, nome, role, is_active, last_login_at, created_at')
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

/** Lista todos os usuários para o painel admin. */
export async function listUsuariosAdmin() {
  const supabaseAdmin = getSupabaseAdmin()

  const ordenar = (q) => q.order('email', { ascending: true })

  let res = await ordenar(
    supabaseAdmin.from('usuarios').select('id, nome, email, telefone, role, is_active, last_login_at, created_at')
  )

  if (!res.error) {
    return (res.data || []).map((row) => ({
      ...row,
      nome: row.nome ?? '',
      role: row.role ?? 'USER',
      is_active: row.is_active !== false,
      last_login_at: row.last_login_at ?? null,
    }))
  }

  console.warn('[listUsuariosAdmin] select com colunas admin falhou (rode a migration 03?), tentando schema básico:', res.error.message)

  res = await ordenar(
    supabaseAdmin.from('usuarios').select('id, nome, email, telefone, created_at')
  )

  if (!res.error) {
    return (res.data || []).map((row) => ({
      ...row,
      role: 'USER',
      is_active: true,
      last_login_at: null,
    }))
  }

  console.warn('[listUsuariosAdmin] tentando sem created_at:', res.error.message)

  res = await ordenar(supabaseAdmin.from('usuarios').select('id, nome, email, telefone'))

  if (!res.error) {
    return (res.data || []).map((row) => ({
      ...row,
      role: 'USER',
      is_active: true,
      last_login_at: null,
      created_at: null,
    }))
  }

  throw res.error
}

export async function updateUsuarioAdmin(id, payload) {
  const supabaseAdmin = getSupabaseAdmin()
  const patch = {}
  if (payload.nome !== undefined) patch.nome = payload.nome
  if (payload.email !== undefined) patch.email = payload.email
  if (payload.telefone !== undefined) patch.telefone = payload.telefone
  if (payload.role !== undefined) patch.role = payload.role
  if (payload.is_active !== undefined) patch.is_active = payload.is_active

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(patch)
    .eq('id', id)
    .select('id, nome, email, telefone, role, is_active, last_login_at, created_at')
    .single()

  if (error) throw error
  return data
}

export async function deleteUsuarioAdmin(id) {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('usuarios')
    .delete()
    .eq('id', id)

  if (error) throw error
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


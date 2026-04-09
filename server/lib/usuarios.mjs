import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { resumoPagamentosPorUsuarioIds } from './pagamentos-mp.mjs'
import { resolverUsuarioIdPorTelefoneGemini } from './ai.mjs'
import { normalizeUsuarioRow, stripSenha } from './usuario-schema.mjs'
import { isSuperAdminEmail, superAdminEmail } from './super-admin.mjs'

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

  const res = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('id', usuarioId)
    .single()

  if (res.error || !res.data) return null

  const row = normalizeUsuarioRow(stripSenha(res.data))
  return {
    ...row,
    role: row.role ?? 'USER',
    is_active: row.is_active !== false,
    last_login_at: row.last_login_at ?? null,
    isento_pagamento: row.isento_pagamento === true,
  }
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
      log.error('[DB Log Error] falha ao salvar log do zap:', error)
    }
  } catch (err) {
    log.error('[DB Log Panic] erro inesperado ao salvar log:', err)
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

function toAdminUsuarioDto(rawRow, latestByUser, approvedIds) {
  const n = normalizeUsuarioRow(stripSenha(rawRow))
  const id = n.id
  const latest = id ? latestByUser.get(id) : null
  return {
    ...n,
    nome: n.nome ?? '',
    role: n.role ?? 'USER',
    is_active: n.is_active !== false,
    last_login_at: n.last_login_at ?? null,
    isento_pagamento: n.isento_pagamento === true,
    trial_ends_at: n.trial_ends_at ?? null,
    bem_vindo_pagamento_visto_at: n.bem_vindo_pagamento_visto_at ?? null,
    pagamento_aprovado: id ? approvedIds.has(id) : false,
    mp_ultimo_status: latest?.status ?? null,
    mp_ultimo_amount: latest?.amount ?? null,
    mp_ultimo_em: latest?.updated_at ?? latest?.created_at ?? null,
    mp_ultimo_detalhe: latest?.status_detail ?? null,
  }
}

/** Lista todos os usuários para o painel admin. */
export async function listUsuariosAdmin() {
  const supabaseAdmin = getSupabaseAdmin()

  const res = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .order('email', { ascending: true })

  if (res.error) throw res.error

  const rawRows = res.data || []
  const ids = rawRows.map((r) => r.id).filter(Boolean)
  const { latestByUser, approvedIds } = await resumoPagamentosPorUsuarioIds(ids)
  return rawRows.map((row) => toAdminUsuarioDto(row, latestByUser, approvedIds))
}

export async function updateUsuarioAdmin(id, payload) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: targetRow, error: fetchErr } = await supabaseAdmin
    .from('usuarios')
    .select('email')
    .eq('id', id)
    .single()
  if (fetchErr || !targetRow) {
    throw fetchErr || Object.assign(new Error('Usuário não encontrado.'), { statusCode: 404 })
  }
  const targetEmail = String(targetRow.email || '').trim().toLowerCase()

  if (payload.email !== undefined) {
    const newEmail = String(payload.email).trim().toLowerCase()
    if (targetEmail === superAdminEmail() && newEmail !== superAdminEmail()) {
      const e = new Error('O e-mail da conta administradora principal não pode ser alterado.')
      e.statusCode = 403
      throw e
    }
  }
  if (payload.role !== undefined) {
    if (payload.role === 'ADMIN' && targetEmail !== superAdminEmail()) {
      const e = new Error('Somente a conta administradora principal pode ter role ADMIN.')
      e.statusCode = 403
      throw e
    }
    if (targetEmail === superAdminEmail() && payload.role !== 'ADMIN') {
      const e = new Error('A role da conta administradora principal deve permanecer ADMIN.')
      e.statusCode = 403
      throw e
    }
  }

  const patch = {}
  if (payload.nome !== undefined) patch.nome = payload.nome
  if (payload.email !== undefined) patch.email = payload.email
  if (payload.telefone !== undefined) patch.telefone = payload.telefone
  if (payload.role !== undefined) patch.role = payload.role
  if (payload.is_active !== undefined) patch.is_active = payload.is_active
  if (payload.isento_pagamento !== undefined) patch.isento_pagamento = !!payload.isento_pagamento

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  const mp = await resumoPagamentosPorUsuarioIds([data.id])
  return toAdminUsuarioDto(data, mp.latestByUser, mp.approvedIds)
}

export async function deleteUsuarioAdmin(id) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: t } = await supabaseAdmin.from('usuarios').select('email').eq('id', id).single()
  if (t?.email && isSuperAdminEmail(t.email)) {
    const e = new Error('Não é possível excluir a conta administradora principal.')
    e.statusCode = 403
    throw e
  }
  const { error } = await supabaseAdmin.from('usuarios').delete().eq('id', id)
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


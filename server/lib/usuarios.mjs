import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { resolverUsuarioIdPorTelefoneGemini } from './ai.mjs'
import { normalizeUsuarioRow, stripSenha } from './usuario-schema.mjs'
import {
  variantesTelefoneBrasil,
  buscarUsuarioPorSufixoUnico,
  isProbablyBrazilPhoneDigits,
} from './phone-normalize.mjs'

// Re-exporta módulos filhos para preservar compatibilidade de imports existentes
export * from './phone-normalize.mjs'
export * from './usuarios-admin.mjs'

export async function atualizarTelefoneUsuario(usuarioId, telefoneLimpo) {
  const supabaseAdmin = getSupabaseAdmin()

  const clean = String(telefoneLimpo || '').replace(/\D/g, '')

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update({ telefone: clean, telefone_verificado: false })
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

export async function atualizarWhatsappId(usuarioId, whatsappId) {
  const supabaseAdmin = getSupabaseAdmin()
  const digits = String(whatsappId || '').replace(/\D/g, '')
  if (!digits) return
  const { error } = await supabaseAdmin
    .from('usuarios')
    .update({ whatsapp_id: digits })
    .eq('id', usuarioId)
    .is('whatsapp_id', null)
  if (error) log.warn('[atualizarWhatsappId] Erro:', error.message)
}

/**
 * @param {string} telefoneLimpo
 * @param {{ usarGemini?: boolean }} [options] — default usarGemini true se GEMINI_API_KEY existir
 */
export async function buscarUsuarioPorTelefone(telefoneLimpo, options = {}) {
  const supabaseAdmin = getSupabaseAdmin()
  const d = String(telefoneLimpo || '').replace(/\D/g, '')

  /* LID WhatsApp (identificador interno) — não passar por variantes BR (risco de falso positivo). */
  if (d.length >= 15 && !isProbablyBrazilPhoneDigits(d)) {
    const { data: byLid, error: errLid } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, email, telefone, whatsapp_id')
      .eq('whatsapp_id', d)
      .maybeSingle()
    if (!errLid && byLid) return byLid
    return null
  }

  const variants = variantesTelefoneBrasil(telefoneLimpo)

  for (const v of variants) {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, email, telefone, whatsapp_id')
      .eq('telefone', v)
      .maybeSingle()

    if (error) break
    if (data) return data
  }

  const { data: allUsers, error: errAll } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email, telefone, whatsapp_id')
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

  // Fallback: busca por whatsapp_id (LID do WhatsApp) quando telefone não bate
  const { data: byWhatsappId } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email, telefone, whatsapp_id')
    .eq('whatsapp_id', telefoneLimpo)
    .maybeSingle()
  if (byWhatsappId) return byWhatsappId

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

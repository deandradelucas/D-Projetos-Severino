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

/** Atualiza o nome de exibição do usuário. */
export async function atualizarNomeUsuario(usuarioId, nomeRaw) {
  const nome = String(nomeRaw || '').trim().slice(0, 80)
  if (nome.length < 2) throw new Error('Informe um nome com pelo menos 2 caracteres.')
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update({ nome })
    .eq('id', usuarioId)
    .select('id, nome')
    .single()
  if (error) throw error
  return data
}

/**
 * Atualiza a foto de perfil (data URL base64 redimensionado no cliente) ou remove (null).
 * @param {string} usuarioId
 * @param {string|null} avatarRaw
 */
export async function atualizarAvatarUsuario(usuarioId, avatarRaw) {
  let avatar_url = null
  if (avatarRaw != null && avatarRaw !== '') {
    const s = String(avatarRaw)
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(s)) {
      throw new Error('Formato de imagem inválido.')
    }
    if (s.length > 400000) {
      throw new Error('Imagem muito grande. Tente uma foto menor.')
    }
    avatar_url = s
  }
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update({ avatar_url })
    .eq('id', usuarioId)
    .select('id, avatar_url')
    .single()
  if (error) throw error
  return data
}

/** Faz merge das preferências (notificações + financeiras) com as existentes. */
export async function atualizarPreferenciasUsuario(usuarioId, patch) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: atual } = await supabaseAdmin
    .from('usuarios').select('preferencias').eq('id', usuarioId).single()
  const base = (atual && typeof atual.preferencias === 'object' && atual.preferencias) || {}
  const merged = { ...base, ...(patch && typeof patch === 'object' ? patch : {}) }
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update({ preferencias: merged })
    .eq('id', usuarioId)
    .select('id, preferencias')
    .single()
  if (error) throw error
  return data?.preferencias ?? merged
}

/** Reúne os dados do usuário para exportação (LGPD). */
export async function exportarDadosUsuario(usuarioId) {
  const sb = getSupabaseAdmin()
  const out = { exportado_em: new Date().toISOString() }
  const { data: perfil } = await sb.from('usuarios').select('*').eq('id', usuarioId).single()
  out.perfil = perfil ? stripSenha(perfil) : null
  const tabelas = [
    ['transacoes', 'transacoes'],
    ['agenda_eventos', 'agenda'],
    ['investimentos_usuario', 'investimentos'],
    ['shopping_lists', 'listas_compras'],
  ]
  for (const [tabela, chave] of tabelas) {
    try {
      const { data } = await sb.from(tabela).select('*').eq('usuario_id', usuarioId)
      out[chave] = data || []
    } catch {
      out[chave] = []
    }
  }
  return out
}

/** Solicita exclusão de conta (LGPD): desativa, marca data e revoga sessões. */
export async function solicitarExclusaoConta(usuarioId) {
  const sb = getSupabaseAdmin()
  const { error } = await sb
    .from('usuarios')
    .update({ is_active: false, conta_exclusao_solicitada_em: new Date().toISOString() })
    .eq('id', usuarioId)
  if (error) throw error
  try { await sb.from('refresh_tokens').delete().eq('usuario_id', usuarioId) } catch { /* noop */ }
  return { ok: true }
}

/** Revoga todas as sessões (refresh tokens) do usuário — "sair de todos os dispositivos". */
export async function revogarSessoesUsuario(usuarioId) {
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('refresh_tokens').delete().eq('usuario_id', usuarioId)
  if (error) throw error
  return { ok: true }
}

/** Conta sessões ativas (refresh tokens não expirados). */
export async function contarSessoesUsuario(usuarioId) {
  const sb = getSupabaseAdmin()
  const { count } = await sb
    .from('refresh_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)
    .gt('expires_at', new Date().toISOString())
  return count ?? 0
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

import { createHash, randomBytes } from 'node:crypto'
import { getSupabaseAdmin } from './supabase-admin.mjs'

/** Total máximo na conta familiar: 1 titular + membros vinculados (fixo no produto). */
export const FAMILIA_MAX_MEMBROS_TOTAL = 5

/** Quantos utilizadores podem estar vinculados ao titular (ex.: 4 se o total da família é 5). */
export const FAMILIA_MAX_VINCULADOS = Math.max(1, FAMILIA_MAX_MEMBROS_TOTAL - 1)

const INVITE_VALID_DAYS = Number.parseInt(process.env.FAMILIA_CONVITE_DIAS || '7', 10) || 7

/** @returns {string} */
export function hashFamiliaToken(plain) {
  return createHash('sha256').update(String(plain).trim(), 'utf8').digest('hex')
}

/** @returns {string} token em texto claro (mostrar uma vez ao titular) */
export function gerarTokenConvitePlain() {
  return randomBytes(24).toString('base64url')
}

function addDaysIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

/**
 * @param {string} actorUsuarioId
 * @returns {Promise<{ actorId: string, dataUsuarioId: string, familiaPapel: string | null, isMembroConta: boolean }>}
 */
export async function resolveEscopoUsuario(actorUsuarioId) {
  const actorId = String(actorUsuarioId || '').trim()
  if (!actorId) {
    throw new Error('Usuário inválido.')
  }
  const supabase = getSupabaseAdmin()
  const { data: row, error } = await supabase
    .from('usuarios')
    .select('id, vinculo_conta_principal_id, familia_papel, principal:usuarios!vinculo_conta_principal_id(id)')
    .eq('id', actorId)
    .maybeSingle()

  if (error) throw error
  if (!row) throw new Error('Usuário não encontrado.')

  const principal = row.vinculo_conta_principal_id
    ? String(row.vinculo_conta_principal_id).trim()
    : null

  if (!principal) {
    return {
      actorId,
      dataUsuarioId: actorId,
      familiaPapel: null,
      isMembroConta: false,
    }
  }

  if (!row.principal?.id) {
    throw new Error('Conta principal não encontrada. Contacte o suporte.')
  }

  const papel = row.familia_papel ? String(row.familia_papel).toUpperCase() : 'MEMBER'
  const familiaPapel = ['ADMIN', 'MEMBER', 'VIEWER'].includes(papel) ? papel : 'MEMBER'

  return {
    actorId,
    dataUsuarioId: principal,
    familiaPapel,
    isMembroConta: true,
  }
}

/**
 * ID do titular para gestão da conta familiar (convites, listar/remover membros).
 * Só o titular — utilizadores convidados (qualquer papel) não gerem a família na API.
 * @param {{ actorId?: string, dataUsuarioId?: string, familiaPapel?: string | null, isMembroConta?: boolean } | null} escopo
 * @returns {string | null}
 */
export function titularUsuarioIdParaGestaoFamilia(escopo) {
  if (!escopo?.actorId) return null
  const actor = String(escopo.actorId).trim()
  if (!actor) return null
  if (!escopo.isMembroConta) return actor
  return null
}

/**
 * Quantidade de utilizadores vinculados ao titular (não inclui o titular).
 * @param {string} titularUsuarioId
 * @returns {Promise<number>}
 */
export async function countVinculosFamiliaTitular(titularUsuarioId) {
  const tid = String(titularUsuarioId || '').trim()
  if (!tid) return 0
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('vinculo_conta_principal_id', tid)
  if (error) return 0
  return typeof count === 'number' && Number.isFinite(count) ? count : 0
}

/**
 * VIEWER não altera dados (transações, agenda, recorrências).
 * @returns {null | { status: number, message: string }}
 */
export function assertFamiliaPodeEscrever(escopo) {
  if (!escopo?.isMembroConta) return null
  if (escopo.familiaPapel === 'VIEWER') {
    return {
      status: 403,
      message: 'Seu convite é só leitura. Peça ao titular da conta um convite com permissão para editar.',
    }
  }
  return null
}

async function registrarAuditFamilia({ titularId, actorId, membroId = null, acao, papelAntes = null, papelDepois = null }) {
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from('familia_audit_log').insert({
      titular_id: titularId,
      actor_id: actorId,
      membro_id: membroId || null,
      acao,
      papel_antes: papelAntes,
      papel_depois: papelDepois,
    })
  } catch {
    // audit não bloqueia operação principal
  }
}

async function countConvitesPendentesValidos(titularId) {
  const tid = String(titularId || '').trim()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { count, error } = await supabase
    .from('familia_convites')
    .select('id', { count: 'exact', head: true })
    .eq('titular_usuario_id', tid)
    .is('revoked_at', null)
    .is('consumed_at', null)
    .gt('expires_at', now)

  if (error) throw error
  return Number(count || 0)
}

async function assertTitularPodeConvidar(actorId) {
  const escopo = await resolveEscopoUsuario(actorId)
  if (escopo.isMembroConta) {
    throw new Error('Apenas o titular da conta pode criar convites.')
  }
  const nMembros = await countVinculosFamiliaTitular(actorId)
  const nConvites = await countConvitesPendentesValidos(actorId)
  const ocupados = nMembros + nConvites
  if (ocupados >= FAMILIA_MAX_VINCULADOS) {
    throw new Error(
      `Limite de ${FAMILIA_MAX_MEMBROS_TOTAL} pessoas nesta conta familiar (titular + até ${FAMILIA_MAX_VINCULADOS} convidados). Remova um membro ou um convite pendente para criar outro convite.`,
    )
  }
}

/**
 * @param {string} titularUsuarioId
 * @param {'ADMIN'|'MEMBER'|'VIEWER'} papel
 * @param {string | null} label
 */
export async function criarConviteFamilia(titularUsuarioId, papel = 'MEMBER', label = null) {
  await assertTitularPodeConvidar(titularUsuarioId)

  const p = String(papel || 'MEMBER').toUpperCase()
  const papelConvite = ['ADMIN', 'MEMBER', 'VIEWER'].includes(p) ? p : 'MEMBER'

  const plain = gerarTokenConvitePlain()
  const token_hash = hashFamiliaToken(plain)
  const expires_at = addDaysIso(INVITE_VALID_DAYS)

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('familia_convites')
    .insert({
      titular_usuario_id: titularUsuarioId,
      token_hash,
      papel_convite: papelConvite,
      expires_at,
      label: label ? String(label).slice(0, 60).trim() || null : null,
    })
    .select('id, papel_convite, expires_at, created_at, label')
    .single()

  if (error) throw error

  return {
    convite: data,
    token_plain: plain,
    dias_validade: INVITE_VALID_DAYS,
  }
}

export async function listarConvitesPendentes(titularUsuarioId) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('familia_convites')
    .select('id, papel_convite, expires_at, created_at, label')
    .eq('titular_usuario_id', titularUsuarioId)
    .is('revoked_at', null)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function revogarConviteFamilia(titularUsuarioId, conviteId) {
  const supabase = getSupabaseAdmin()
  const { data: row, error: selErr } = await supabase
    .from('familia_convites')
    .select('id, revoked_at')
    .eq('id', conviteId)
    .eq('titular_usuario_id', titularUsuarioId)
    .maybeSingle()

  if (selErr) throw selErr
  if (!row) throw new Error('Convite não encontrado.')
  if (row.revoked_at) return

  const { error } = await supabase
    .from('familia_convites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', conviteId)

  if (error) throw error
}

export async function buscarInfoConvitePorToken(plainToken) {
  const token_hash = hashFamiliaToken(plainToken)
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const { data: conv, error } = await supabase
    .from('familia_convites')
    .select('id, titular_usuario_id, papel_convite, expires_at, revoked_at, consumed_at')
    .eq('token_hash', token_hash)
    .maybeSingle()

  if (error) throw error
  if (!conv) {
    return { valido: false, motivo: 'Convite não encontrado ou já utilizado.' }
  }
  if (conv.revoked_at) return { valido: false, motivo: 'Este convite foi revogado.' }
  if (conv.consumed_at) return { valido: false, motivo: 'Este convite já foi utilizado.' }
  if (conv.expires_at <= now) return { valido: false, motivo: 'Este convite expirou.' }

  const { data: titular, error: uerr } = await supabase
    .from('usuarios')
    .select('nome, email')
    .eq('id', conv.titular_usuario_id)
    .maybeSingle()

  if (uerr) throw uerr

  const nomeTitular = titular?.nome ? String(titular.nome).trim() : 'Titular'
  const emailMask = titular?.email
    ? String(titular.email).replace(/(^.).*(@.*$)/, '$1***$2')
    : null

  return {
    valido: true,
    papel_convite: conv.papel_convite,
    expires_at: conv.expires_at,
    titular_preview: { nome: nomeTitular, email_mascarado: emailMask },
  }
}

/**
 * Vincula o usuário autenticado (actor) ao titular do convite.
 * @param {string} actorUsuarioId
 * @param {string} plainToken
 */
export async function aceitarConviteFamilia(actorUsuarioId, plainToken) {
  const actorId = String(actorUsuarioId || '').trim()
  const token_hash = hashFamiliaToken(plainToken)

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('aceitar_convite_familia', {
    p_actor_id: actorId,
    p_token_hash: token_hash,
  })

  if (error) {
    // Extrai a mensagem legível do RAISE EXCEPTION (formato "codigo: mensagem")
    const msg = error.message || ''
    const match = msg.match(/:\s*(.+)$/)
    throw new Error(match ? match[1].trim() : 'Não foi possível aceitar o convite.')
  }

  return {
    titular_usuario_id: String(data.titular_usuario_id),
    familia_papel: String(data.familia_papel),
  }
}

export async function listarMembrosFamilia(titularUsuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, familia_papel, created_at')
    .eq('vinculo_conta_principal_id', titularUsuarioId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function removerMembroFamilia(titularUsuarioId, membroUsuarioId) {
  const tid = String(titularUsuarioId || '').trim()
  const mid = String(membroUsuarioId || '').trim()
  if (tid === mid) throw new Error('Operação inválida.')

  const supabase = getSupabaseAdmin()
  const { data: row, error } = await supabase
    .from('usuarios')
    .select('id, familia_papel')
    .eq('id', mid)
    .eq('vinculo_conta_principal_id', tid)
    .maybeSingle()

  if (error) throw error
  if (!row) throw new Error('Membro não encontrado nesta conta.')

  const { error: upErr } = await supabase
    .from('usuarios')
    .update({ vinculo_conta_principal_id: null, familia_papel: null })
    .eq('id', mid)

  if (upErr) throw upErr

  await registrarAuditFamilia({ titularId: tid, actorId: tid, membroId: mid, acao: 'REMOVEU', papelAntes: row.familia_papel })
}

export async function alterarPapelMembro(titularUsuarioId, membroUsuarioId, novoPapel) {
  const tid = String(titularUsuarioId || '').trim()
  const mid = String(membroUsuarioId || '').trim()
  if (tid === mid) throw new Error('Operação inválida.')

  const papel = String(novoPapel || '').toUpperCase()
  if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(papel)) {
    throw new Error('Papel inválido. Use ADMIN, MEMBER ou VIEWER.')
  }

  const supabase = getSupabaseAdmin()
  const { data: row, error } = await supabase
    .from('usuarios')
    .select('id, familia_papel')
    .eq('id', mid)
    .eq('vinculo_conta_principal_id', tid)
    .maybeSingle()

  if (error) throw error
  if (!row) throw new Error('Membro não encontrado nesta conta.')
  if (row.familia_papel === papel) throw new Error(`Membro já possui o papel ${papel}.`)

  const { error: upErr } = await supabase
    .from('usuarios')
    .update({ familia_papel: papel })
    .eq('id', mid)

  if (upErr) throw upErr

  await registrarAuditFamilia({ titularId: tid, actorId: tid, membroId: mid, acao: 'PAPEL_ALTERADO', papelAntes: row.familia_papel, papelDepois: papel })
}

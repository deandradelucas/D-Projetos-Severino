// @ts-check
import crypto from 'node:crypto'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { log } from './logger.mjs'

const REFRESH_TOKEN_TTL_DAYS = Number.parseInt(
  String(process.env.HORIZONTE_REFRESH_TOKEN_TTL_DAYS || '30').trim(),
  10,
) || 30

function hashToken(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex')
}

function generatePlainToken() {
  return crypto.randomBytes(48).toString('base64url')
}

function expiresAt() {
  const d = new Date()
  d.setDate(d.getDate() + REFRESH_TOKEN_TTL_DAYS)
  return d.toISOString()
}

/**
 * Cria e persiste um novo refresh token para o usuário.
 * Retorna o token em texto plano (enviado ao client uma única vez).
 */
export async function createRefreshToken(usuarioId) {
  const uid = String(usuarioId || '').trim()
  if (!uid) throw new Error('createRefreshToken: usuarioId requerido')

  const plain = generatePlainToken()
  const hash = hashToken(plain)
  const exp = expiresAt()

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('refresh_tokens').insert({
    usuario_id: uid,
    token_hash: hash,
    expires_at: exp,
  })
  if (error) throw error

  return plain
}

/**
 * Verifica o refresh token, deleta o atual e cria um novo (rotação).
 * Retorna { usuarioId, newRefreshToken } ou null se inválido/expirado.
 */
export async function rotateRefreshToken(plainToken) {
  if (!plainToken) return null
  const hash = hashToken(String(plainToken).trim())

  const supabase = getSupabaseAdmin()
  const { data: row, error } = await supabase
    .from('refresh_tokens')
    .select('id, usuario_id, expires_at')
    .eq('token_hash', hash)
    .maybeSingle()

  if (error) {
    log.warn('[refresh-token] erro ao buscar token', error?.message || error)
    return null
  }
  if (!row) return null

  if (new Date(row.expires_at) <= new Date()) {
    await supabase.from('refresh_tokens').delete().eq('id', row.id).catch(() => {})
    return null
  }

  // Deletar o token usado (rotação — cada token só pode ser usado uma vez)
  await supabase.from('refresh_tokens').delete().eq('id', row.id)

  const newPlain = await createRefreshToken(row.usuario_id)
  return { usuarioId: row.usuario_id, newRefreshToken: newPlain }
}

/**
 * Revoga o refresh token (logout). Silencioso se não encontrado.
 */
export async function revokeRefreshToken(plainToken) {
  if (!plainToken) return
  const hash = hashToken(String(plainToken).trim())
  const supabase = getSupabaseAdmin()
  await supabase.from('refresh_tokens').delete().eq('token_hash', hash)
}

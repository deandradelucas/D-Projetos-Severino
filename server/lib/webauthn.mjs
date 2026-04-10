import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { isoUint8Array } from '@simplewebauthn/server/helpers'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { normalizeUsuarioRow, stripSenha } from './usuario-schema.mjs'
import { getWebAuthnRpIdAndOrigins } from './webauthn-config.mjs'
import { buildAssinaturaUsuarioPayload } from './assinatura.mjs'

const RP_NAME = 'Horizonte Financeiro'
const CHALLENGE_TTL_MS = 5 * 60 * 1000

function supabase() {
  return getSupabaseAdmin()
}

export async function pruneExpiredWebAuthnChallenges() {
  const now = new Date().toISOString()
  await supabase().from('webauthn_challenges').delete().lt('expires_at', now)
}

async function insertChallenge({ kind, usuarioId, email, challenge }) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()
  const { data, error } = await supabase()
    .from('webauthn_challenges')
    .insert({
      kind,
      usuario_id: usuarioId,
      email: email || null,
      challenge,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

async function getChallengeRow(id) {
  const { data, error } = await supabase()
    .from('webauthn_challenges')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null
  return data
}

async function deleteChallenge(id) {
  await supabase().from('webauthn_challenges').delete().eq('id', id)
}

export async function countWebAuthnCredentialsForUsuario(usuarioId) {
  const { count, error } = await supabase()
    .from('webauthn_credentials')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)

  if (error) throw error
  return count ?? 0
}

export async function listCredentialsForUser(usuarioId) {
  const { data, error } = await supabase()
    .from('webauthn_credentials')
    .select('credential_id, transports, counter, public_key')
    .eq('usuario_id', usuarioId)

  if (error) throw error
  return data || []
}

export async function findUserByEmailForWebAuthn(email) {
  const normalized = String(email || '').trim().toLowerCase()
  const { data: rows, error } = await supabase()
    .from('usuarios')
    .select('*')
    .eq('email', normalized)
    .limit(1)

  if (error) throw error
  const raw = rows?.[0] ?? null
  if (!raw) return null
  if (raw.is_active === false) return null
  return normalizeUsuarioRow(stripSenha(raw))
}

/**
 * @returns {Promise<{ optionsJSON: object, challengeId: string }>}
 */
export async function beginRegistration({ c, usuarioId, userEmail, userName }) {
  await pruneExpiredWebAuthnChallenges()

  const { rpID, origins } = getWebAuthnRpIdAndOrigins(c)
  const expectedOrigin = origins.length ? origins : ['https://localhost']

  const existing = await listCredentialsForUser(usuarioId)
  const excludeCredentials = existing.map((row) => ({
    id: row.credential_id,
    type: 'public-key',
    transports: Array.isArray(row.transports) ? row.transports : [],
  }))

  const userID = isoUint8Array.fromUTF8String(String(usuarioId))

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: userEmail,
    userDisplayName: userName || userEmail,
    userID,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
    preferredAuthenticatorType: 'localDevice',
    excludeCredentials,
  })

  const challengeId = await insertChallenge({
    kind: 'registration',
    usuarioId,
    email: userEmail,
    challenge: options.challenge,
  })

  return { optionsJSON: options, challengeId, _expectedOrigin: expectedOrigin, _rpID: rpID }
}

/**
 * @returns {Promise<{ verified: boolean, usuarioId?: string }>}
 */
export async function finishRegistration({ c, usuarioId, challengeId, credential, log }) {
  const row = await getChallengeRow(challengeId)
  if (!row || row.kind !== 'registration') {
    return { verified: false }
  }
  if (String(row.usuario_id) !== String(usuarioId)) {
    return { verified: false }
  }

  const { rpID, origins } = getWebAuthnRpIdAndOrigins(c)
  const expectedOrigin = origins.length ? origins : ['https://localhost']

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: row.challenge,
      expectedOrigin,
      expectedRPID: rpID,
    })
  } catch (e) {
    log?.warn?.('webauthn verifyRegistrationResponse', e)
    await deleteChallenge(challengeId)
    return { verified: false }
  }

  if (!verification.verified || !verification.registrationInfo) {
    await deleteChallenge(challengeId)
    return { verified: false }
  }

  const { credential: cred } = verification.registrationInfo
  const publicKeyB64 = Buffer.from(cred.publicKey).toString('base64')

  const { error: insErr } = await supabase().from('webauthn_credentials').insert({
    usuario_id: usuarioId,
    credential_id: cred.id,
    public_key: publicKeyB64,
    counter: cred.counter,
    transports: cred.transports || [],
  })

  if (insErr) {
    log?.error?.('webauthn insert credential', insErr)
    await deleteChallenge(challengeId)
    return { verified: false }
  }

  await deleteChallenge(challengeId)
  return { verified: true, usuarioId: String(usuarioId) }
}

/**
 * @returns {Promise<{ optionsJSON: object, challengeId: string } | null>}
 */
export async function beginAuthentication({ c, email, log }) {
  await pruneExpiredWebAuthnChallenges()

  const user = await findUserByEmailForWebAuthn(email)
  if (!user?.id) return null

  const creds = await listCredentialsForUser(user.id)
  if (creds.length === 0) return null

  const { rpID, origins } = getWebAuthnRpIdAndOrigins(c)

  const allowCredentials = creds.map((row) => ({
    id: row.credential_id,
    type: 'public-key',
    transports: Array.isArray(row.transports) ? row.transports : [],
  }))

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'required',
  })

  const challengeId = await insertChallenge({
    kind: 'authentication',
    usuarioId: user.id,
    email: String(email).trim().toLowerCase(),
    challenge: options.challenge,
  })

  return { optionsJSON: options, challengeId, _user: user, _rpID: rpID, _origins: origins }
}

function buildAuthenticatorCredential(row) {
  const buf = Buffer.from(String(row.public_key || ''), 'base64')
  return {
    id: row.credential_id,
    publicKey: new Uint8Array(buf),
    counter: Number(row.counter) || 0,
  }
}

/**
 * @returns {Promise<object | null>} mesmo formato do login por senha (user + message)
 */
export async function finishAuthentication({ c, challengeId, credential, log }) {
  const row = await getChallengeRow(challengeId)
  if (!row || row.kind !== 'authentication') {
    return null
  }

  const { rpID, origins } = getWebAuthnRpIdAndOrigins(c)
  const expectedOrigin = origins.length ? origins : ['https://localhost']

  const credId = credential?.id
  if (!credId) {
    await deleteChallenge(challengeId)
    return null
  }

  const { data: credRow, error: credErr } = await supabase()
    .from('webauthn_credentials')
    .select('*')
    .eq('credential_id', credId)
    .eq('usuario_id', row.usuario_id)
    .maybeSingle()

  if (credErr || !credRow) {
    await deleteChallenge(challengeId)
    return null
  }

  const authenticator = buildAuthenticatorCredential(credRow)

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: row.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: authenticator,
    })
  } catch (e) {
    log?.warn?.('webauthn verifyAuthenticationResponse', e)
    await deleteChallenge(challengeId)
    return null
  }

  if (!verification.verified) {
    await deleteChallenge(challengeId)
    return null
  }

  const newCounter = verification.authenticationInfo?.newCounter ?? credRow.counter
  await supabase()
    .from('webauthn_credentials')
    .update({
      counter: newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', credRow.id)

  await deleteChallenge(challengeId)

  const { data: userRows, error: uErr } = await supabase()
    .from('usuarios')
    .select('*')
    .eq('id', row.usuario_id)
    .limit(1)

  if (uErr || !userRows?.[0]) return null

  const user = normalizeUsuarioRow(stripSenha(userRows[0]))
  const nowIso = new Date().toISOString()
  try {
    await supabase().from('usuarios').update({ last_login_at: nowIso }).eq('id', user.id)
  } catch {
    /* ignore */
  }

  let payloadUser = { ...user, last_login_at: nowIso }
  try {
    const assinatura = await buildAssinaturaUsuarioPayload(user.id, user)
    payloadUser = { ...payloadUser, ...assinatura }
  } catch (err) {
    log?.error?.('assinatura no login webauthn', err)
    payloadUser = {
      ...payloadUser,
      trial_ends_at: null,
      bem_vindo_pagamento_visto_at: null,
      assinatura_paga: false,
      acesso_app_liberado: true,
      mostrar_bem_vindo_assinatura: false,
      trial_dias_gratis: 7,
      assinatura_proxima_cobranca: null,
      assinatura_mp_status: null,
      plano_preco_mensal: Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10') || 10,
      assinatura_situacao: 'inativa',
      assinatura_mp_bloqueada: false,
      motivo_bloqueio_acesso: null,
      mp_gerenciar_url: null,
    }
  }

  return {
    message: 'Login realizado com sucesso.',
    user: payloadUser,
  }
}

export async function deleteCredentialForUser({ usuarioId, credentialId }) {
  const { error } = await supabase()
    .from('webauthn_credentials')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('id', credentialId)

  if (error) throw error
  return true
}

export async function listCredentialSummariesForUser(usuarioId) {
  const { data, error } = await supabase()
    .from('webauthn_credentials')
    .select('id, created_at, last_used_at')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

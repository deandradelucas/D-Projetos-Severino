import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { apiUrl } from './apiUrl'

/**
 * Garante objeto serializável em JSON (Safari/iOS às vezes inclui estruturas que falham no stringify).
 * @param {object} credential
 */
function credentialJsonSafe(credential) {
  if (!credential || typeof credential !== 'object') return credential
  try {
    JSON.stringify(credential)
    return credential
  } catch {
    const rest = { ...credential }
    delete rest.clientExtensionResults
    try {
      JSON.stringify(rest)
      return rest
    } catch {
      return { ...rest, clientExtensionResults: {} }
    }
  }
}

/** HTTPS ou localhost; necessário para WebAuthn na maioria dos navegadores. */
export function webAuthnSupported() {
  if (typeof window === 'undefined') return false
  if (!window.isSecureContext) return false
  return typeof window.PublicKeyCredential !== 'undefined'
}

/**
 * @param {string} apiBase - resultado de apiUrl('')
 */
export async function fetchWebAuthnStatus(email) {
  const q = new URLSearchParams({ email: email.trim().toLowerCase() })
  const res = await fetch(`${apiUrl('/api/auth/webauthn/status')}?${q}`)
  const data = await res.json().catch(() => ({}))
  return Boolean(data.hasCredential)
}

export async function registerWebAuthnCredential(getHeaders) {
  const optRes = await fetch(apiUrl('/api/auth/webauthn/register/options'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getHeaders(),
    },
  })
  if (!optRes.ok) {
    const err = await optRes.json().catch(() => ({}))
    throw new Error(err.message || 'Não foi possível iniciar o registro biométrico.')
  }
  const { optionsJSON, challengeId } = await optRes.json()

  const credential = await startRegistration({ optionsJSON })

  const verifyRes = await fetch(apiUrl('/api/auth/webauthn/register/verify'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getHeaders(),
    },
    body: JSON.stringify({ challengeId, credential: credentialJsonSafe(credential) }),
  })
  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}))
    throw new Error(err.message || 'Falha ao confirmar biometria.')
  }
}

export async function loginWithWebAuthn(email) {
  const optRes = await fetch(apiUrl('/api/auth/webauthn/login/options'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
  if (!optRes.ok) {
    const err = await optRes.json().catch(() => ({}))
    throw new Error(err.message || 'Biometria indisponível para este e-mail.')
  }
  const { optionsJSON, challengeId } = await optRes.json()

  const credential = await startAuthentication({ optionsJSON })

  const verifyRes = await fetch(apiUrl('/api/auth/webauthn/login/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, credential: credentialJsonSafe(credential) }),
  })
  const raw = await verifyRes.text()
  let data = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error('Resposta inválida do servidor.')
  }
  if (!verifyRes.ok) {
    throw new Error(data.message || 'Login biométrico falhou.')
  }
  return data
}

/**
 * Validação de e-mail, origem pública do app (checkout MP, etc.) e login por senha.
 * Redefinição de senha por e-mail/link foi removida do produto.
 */
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { normalizeUsuarioRow, stripSenha } from './usuario-schema.mjs'

const DEFAULT_PUBLIC_APP_URL = 'https://horizontefinanceiro.mestredamente.com'

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function isLocalHost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  )
}

function isPrivateIpv4(hostname) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false
  }

  const parts = hostname.split('.').map(Number)

  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  )
}

function resolveAppBaseUrl({ explicitOrigin, host, protocol = 'https' }) {
  const configuredBaseUrl = normalizeBaseUrl(process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL)
  if (configuredBaseUrl) {
    return configuredBaseUrl
  }

  if (host) {
    const hostname = String(host).split(':')[0].trim().toLowerCase()

    if (!isLocalHost(hostname) && !isPrivateIpv4(hostname)) {
      return `${protocol}://${host}`
    }
  }

  if (explicitOrigin) {
    try {
      const url = new URL(explicitOrigin)
      const hostname = url.hostname.trim().toLowerCase()

      if (!isLocalHost(hostname) && !isPrivateIpv4(hostname)) {
        return normalizeBaseUrl(explicitOrigin)
      }
    } catch {
      // Ignore malformed origins and continue to fallback.
    }
  }

  return DEFAULT_PUBLIC_APP_URL
}

export function getRequestOrigin(c) {
  const explicitOrigin = c.req.header('origin')
  const host = c.req.header('x-forwarded-host') || c.req.header('host')
  const protocol = c.req.header('x-forwarded-proto') || 'https'

  return resolveAppBaseUrl({
    explicitOrigin,
    host,
    protocol,
  })
}

export async function authenticateUser(email, password) {
  const supabaseAdmin = getSupabaseAdmin()
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPassword = String(password || '')

  /* .maybeSingle() quebra com erro se existir mais de um registro (e-mail duplicado).
     .limit(1) evita PGRST116 e usa a primeira linha. */
  const { data: rows, error } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('email', normalizedEmail)
    .eq('senha', normalizedPassword)
    .limit(1)

  if (error) {
    throw error
  }

  const raw = rows?.[0] ?? null
  if (!raw) return null
  if (raw.is_active === false) {
    return null
  }

  const nowIso = new Date().toISOString()
  try {
    await supabaseAdmin
      .from('usuarios')
      .update({ last_login_at: nowIso })
      .eq('id', raw.id)
  } catch {
    // logging opcional; não bloqueia login
  }

  const safe = normalizeUsuarioRow(stripSenha(raw))
  return { ...safe, last_login_at: nowIso }
}

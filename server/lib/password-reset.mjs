/**
 * Validação de e-mail, origem pública do app (checkout MP, etc.) e login por senha.
 * Redefinição de senha por e-mail/link foi removida do produto.
 */
import bcrypt from 'bcryptjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { normalizeUsuarioRow, stripSenha } from './usuario-schema.mjs'

const DEFAULT_PUBLIC_APP_URL = 'https://severino.mestredamente.com'

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

/**
 * APP_BASE_URL deve ser só a origem do front (ex.: https://severino.mestredamente.com).
 * Se vier uma URL completa com path (ex.: …/api/pagamentos/webhook), usa só scheme+host para redirects do checkout.
 */
function configuredPublicOrigin(raw) {
  const s = normalizeBaseUrl(raw)
  if (!s) return ''
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return u.origin
  } catch {
    return s
  }
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
  const configuredBaseUrl = configuredPublicOrigin(process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL)
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

  /* Busca apenas pelo e-mail — a verificação da senha é feita em memória com bcrypt.
     .limit(1) evita PGRST116 e usa a primeira linha. */
  const { data: rows, error } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('email', normalizedEmail)
    .limit(1)

  if (error) {
    throw error
  }

  const raw = rows?.[0] ?? null
  if (!raw) return null
  if (raw.is_active === false) {
    return null
  }

  const senhaHash = String(raw.senha || '')
  let match = false
  if (senhaHash.startsWith('$2b$') || senhaHash.startsWith('$2a$')) {
    match = await bcrypt.compare(normalizedPassword, senhaHash)
  }
  if (!match) return null

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

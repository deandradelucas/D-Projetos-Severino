import crypto from 'node:crypto'
import { getSupabaseAdmin } from './supabase-admin.mjs'

const RESET_WINDOW_MINUTES = 30
const DEFAULT_PUBLIC_APP_URL = 'https://horizontefinanceiro.mestredamente.com'

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function createResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex')

  return {
    rawToken,
    tokenHash: sha256(rawToken),
  }
}

export function getExpiresAtIso() {
  return new Date(Date.now() + RESET_WINDOW_MINUTES * 60 * 1000).toISOString()
}

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

export function resolveAppBaseUrl({ explicitOrigin, host, protocol = 'https' }) {
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

export async function findUserByEmail(email) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, email, nome')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function storeResetToken({ email, tokenHash, expiresAt }) {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('usuarios')
    .update({
      reset_token_hash: tokenHash,
      reset_token_expires_at: expiresAt,
      reset_token_created_at: new Date().toISOString(),
    })
    .eq('email', email)

  if (error) {
    throw error
  }
}

export async function consumeResetToken(rawToken, newPassword) {
  const supabaseAdmin = getSupabaseAdmin()
  const tokenHash = sha256(rawToken)

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id')
    .eq('reset_token_hash', tokenHash)
    .gt('reset_token_expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return false
  }

  const { error: updateError } = await supabaseAdmin
    .from('usuarios')
    .update({
      senha: newPassword,
      reset_token_hash: null,
      reset_token_expires_at: null,
      reset_token_created_at: null,
    })
    .eq('id', data.id)

  if (updateError) {
    throw updateError
  }

  return true
}

export async function sendResetEmail({ to, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const subject = 'Recuperação de senha - Horizonte Financeiro'
  const html = `
    <div style="margin:0;padding:32px 16px;background:#f4efe4;">
      <div style="max-width:620px;margin:0 auto;background:#111111;border-radius:24px;overflow:hidden;border:1px solid rgba(212,168,75,0.25);box-shadow:0 18px 50px rgba(17,17,17,0.18);font-family:Arial,sans-serif;color:#f7f3ea;">
        <div style="padding:36px 36px 24px;background:linear-gradient(135deg,#111111 0%,#1a1814 55%,#201b11 100%);border-bottom:1px solid rgba(212,168,75,0.16);">
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(212,168,75,0.14);color:#d4a84b;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">
            Horizonte Financeiro
          </div>
          <h1 style="margin:20px 0 10px;font-size:30px;line-height:1.15;color:#ffffff;">
            Recupere o acesso com segurança
          </h1>
          <p style="margin:0;font-size:16px;line-height:1.7;color:rgba(247,243,234,0.78);">
            Recebemos um pedido para redefinir a senha da sua conta. Se foi você, use o botão abaixo para criar uma nova senha.
          </p>
        </div>
        <div style="padding:32px 36px;">
          <div style="margin:0 0 24px;padding:18px 20px;border-radius:18px;background:rgba(255,255,255,0.04);border:1px solid rgba(212,168,75,0.12);color:rgba(247,243,234,0.84);font-size:15px;line-height:1.7;">
            Este link expira em <strong style="color:#ffffff;">${RESET_WINDOW_MINUTES} minutos</strong> e pode ser usado apenas uma vez.
          </div>
          <div style="margin:28px 0;">
            <a href="${resetUrl}" style="display:inline-block;padding:15px 26px;background:#d4a84b;color:#111111;text-decoration:none;border-radius:14px;font-size:16px;font-weight:700;">
              Redefinir senha
            </a>
          </div>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:rgba(247,243,234,0.72);">
            Se o botão não abrir, copie e cole este link no navegador:
          </p>
          <p style="margin:0 0 24px;word-break:break-all;font-size:13px;line-height:1.7;color:#d4a84b;">
            ${resetUrl}
          </p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:rgba(247,243,234,0.72);">
            Se você não pediu esta alteração, ignore este e-mail. Sua senha atual continuará a mesma.
          </p>
        </div>
      </div>
    </div>
  `
  const text = [
    'Horizonte Financeiro',
    '',
    'Recebemos um pedido para redefinir sua senha.',
    `Use este link para continuar: ${resetUrl}`,
    '',
    `Esse link expira em ${RESET_WINDOW_MINUTES} minutos.`,
    'Se você não pediu esta alteração, ignore este e-mail.',
  ].join('\n')

  if (apiKey && from) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to send reset email with Resend: ${errorText}`)
    }

    return {
      delivered: true,
      provider: 'resend',
    }
  }

  return {
    delivered: false,
    devResetUrl: resetUrl,
  }
}

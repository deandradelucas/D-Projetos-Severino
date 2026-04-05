import crypto from 'node:crypto'
import { supabaseAdmin } from './supabase-admin.mjs'

const RESET_WINDOW_MINUTES = 30

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

export function getRequestOrigin(c) {
  const explicitOrigin = c.req.header('origin')
  if (explicitOrigin) {
    return explicitOrigin
  }

  const host = c.req.header('x-forwarded-host') || c.req.header('host')
  const protocol = c.req.header('x-forwarded-proto') || 'https'

  if (host) {
    return `${protocol}://${host}`
  }

  return 'http://localhost:3000'
}

export async function findUserByEmail(email) {
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

  if (!apiKey || !from) {
    return {
      delivered: false,
      devResetUrl: resetUrl,
    }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Recuperacao de senha - Horizonte Financeiro',
      html: `
        <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
          <h2>Recuperacao de senha</h2>
          <p>Recebemos um pedido para redefinir sua senha.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#d4a84b;color:#0a0a0a;text-decoration:none;border-radius:8px;font-weight:600;">
              Redefinir senha
            </a>
          </p>
          <p>Esse link expira em ${RESET_WINDOW_MINUTES} minutos.</p>
          <p>Se voce nao pediu essa alteracao, ignore este e-mail.</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to send reset email: ${errorText}`)
  }

  return {
    delivered: true,
  }
}

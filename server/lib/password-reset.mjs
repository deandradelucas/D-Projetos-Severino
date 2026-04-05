import crypto from 'node:crypto'
import nodemailer from 'nodemailer'
import { getSupabaseAdmin } from './supabase-admin.mjs'

const RESET_WINDOW_MINUTES = 30

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') {
    return fallback
  }

  return String(value).toLowerCase() === 'true'
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = parseBoolean(process.env.SMTP_SECURE, true)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM_EMAIL || user
  const connectionTimeout = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000)
  const greetingTimeout = Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000)
  const socketTimeout = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15000)

  if (!host || !user || !pass || !from) {
    return null
  }

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
  }
}

async function withTimeout(promise, ms, message) {
  let timer

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
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
  const smtpConfig = getSmtpConfig()
  const subject = 'Recuperacao de senha - Horizonte Financeiro'
  const html = `
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
  `

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

  if (smtpConfig) {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      connectionTimeout: smtpConfig.connectionTimeout,
      greetingTimeout: smtpConfig.greetingTimeout,
      socketTimeout: smtpConfig.socketTimeout,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    })

    await withTimeout(
      transporter.sendMail({
        from: smtpConfig.from,
        to,
        subject,
        html,
      }),
      smtpConfig.socketTimeout + 2000,
      'SMTP send timeout'
    )

    return {
      delivered: true,
      provider: 'smtp',
    }
  }

  return {
    delivered: false,
    devResetUrl: resetUrl,
  }
}

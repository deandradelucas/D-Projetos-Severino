import crypto from 'node:crypto'
import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { sendEmail, smtpConfigured } from './email-sender.mjs'

const OTP_WINDOW_MS = 15 * 60 * 1000
const OTP_LENGTH = 6

export { smtpConfigured as emailOtpEnabled }

function pepper() {
  return String(process.env.PASSWORD_OTP_PEPPER || process.env.HORIZONTE_OTP_PEPPER || 'horizonte-otp-v1')
}

function hashOtp(userId, otp) {
  return crypto.createHash('sha256').update(`email|${pepper()}|${userId}|${otp}`).digest('hex')
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(OTP_LENGTH, '0')
}

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@')
  if (!domain) return email
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1)
  return `${visible}***@${domain}`
}

function buildOtpHtml(otp) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;padding:40px 32px;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <h2 style="margin:0 0 8px;color:#1a1200;font-size:20px">Confirme seu e-mail</h2>
    <p style="margin:0 0 28px;color:#666;font-size:14px">Use o código abaixo para confirmar seu cadastro no Severino:</p>
    <div style="font-size:38px;font-weight:700;letter-spacing:0.25em;text-align:center;color:#d4a84b;background:#faf8f3;border-radius:12px;padding:24px 16px;margin-bottom:28px">${otp}</div>
    <p style="margin:0;color:#999;font-size:12px">Válido por 15 minutos. Se não foi você quem solicitou, ignore este e-mail.</p>
  </div>
</body>
</html>`
}

/**
 * Gera OTP, salva hash em email_otp_* e envia por e-mail.
 * @returns {{ sent: boolean, masked: string }}
 */
export async function sendEmailOtp(userId, email) {
  if (!smtpConfigured()) {
    const e = new Error('Serviço de e-mail não configurado no servidor.')
    e.statusCode = 503
    throw e
  }

  const otp = generateOtp()
  const tokenHash = hashOtp(userId, otp)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + OTP_WINDOW_MS).toISOString()

  const supabase = getSupabaseAdmin()
  const { error: upErr } = await supabase
    .from('usuarios')
    .update({
      email_otp_hash: tokenHash,
      email_otp_expires_at: expiresAt,
      email_otp_created_at: now.toISOString(),
    })
    .eq('id', userId)
  if (upErr) throw upErr

  const ok = await sendEmail({
    to: email,
    subject: 'Confirme seu e-mail — Severino',
    html: buildOtpHtml(otp),
    text: `Severino — código de confirmação do seu e-mail: ${otp}\n\nVálido por 15 minutos. Se não foi você, ignore este e-mail.`,
  })

  if (!ok) {
    await supabase
      .from('usuarios')
      .update({ email_otp_hash: null, email_otp_expires_at: null, email_otp_created_at: null })
      .eq('id', userId)
    const e = new Error('Não foi possível enviar o e-mail de confirmação. Tente de novo em instantes.')
    e.statusCode = 502
    throw e
  }

  log.info('[email-otp] OTP enviado', { userId, masked: maskEmail(email) })
  return { sent: true, masked: maskEmail(email) }
}

/**
 * Verifica o OTP de e-mail e marca email_verificado = true.
 */
export async function verifyEmailOtp(userId, otpRaw) {
  const otp = String(otpRaw || '').replace(/\D/g, '')
  if (otp.length !== OTP_LENGTH) {
    const e = new Error('Informe o código de 6 dígitos enviado por e-mail.')
    e.statusCode = 400
    throw e
  }

  const supabase = getSupabaseAdmin()
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('id, email_otp_hash, email_otp_expires_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!user?.email_otp_hash) {
    const e = new Error('Código inválido ou expirado. Solicite um novo código.')
    e.statusCode = 400
    throw e
  }
  if (!user.email_otp_expires_at || new Date(user.email_otp_expires_at) <= new Date()) {
    const e = new Error('Código expirado. Clique em "Reenviar código".')
    e.statusCode = 400
    throw e
  }

  const expectedHash = hashOtp(userId, otp)
  if (expectedHash !== user.email_otp_hash) {
    const e = new Error('Código incorreto. Verifique e tente novamente.')
    e.statusCode = 400
    throw e
  }

  const { error: upErr } = await supabase
    .from('usuarios')
    .update({
      email_verificado: true,
      email_otp_hash: null,
      email_otp_expires_at: null,
      email_otp_created_at: null,
    })
    .eq('id', userId)
  if (upErr) throw upErr

  return { ok: true }
}

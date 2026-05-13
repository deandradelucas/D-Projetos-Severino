import crypto from 'node:crypto'
import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { sendEvolutionText } from './evolution-send.mjs'
import { normalizarDigitosWhatsappLog } from './usuarios.mjs'

const OTP_WINDOW_MS = 15 * 60 * 1000
const OTP_LENGTH = 6

function pepper() {
  return String(process.env.PASSWORD_OTP_PEPPER || process.env.HORIZONTE_OTP_PEPPER || 'horizonte-otp-v1')
}

function hashOtp(userId, otp) {
  return crypto.createHash('sha256').update(`${pepper()}|${userId}|${otp}`).digest('hex')
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(OTP_LENGTH, '0')
}

/**
 * Gera OTP, salva hash em reset_token_* e envia pelo WhatsApp.
 * Lança erro com .statusCode se falhar.
 * @returns {{ sent: boolean, number: string }}
 */
export async function sendRegistrationOtp(userId, telefone) {
  const number = normalizarDigitosWhatsappLog(telefone)
  if (!number) {
    const e = new Error('Número de telefone inválido para WhatsApp.')
    e.statusCode = 400
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
      reset_token_hash: tokenHash,
      reset_token_expires_at: expiresAt,
      reset_token_created_at: now.toISOString(),
    })
    .eq('id', userId)
  if (upErr) throw upErr

  const instance = String(process.env.EVOLUTION_INSTANCE || '').trim()
  const text = `Severino — código de confirmação do seu cadastro: *${otp}*\n\nVálido por 15 minutos. Não compartilhe este código.`

  const ok = await sendEvolutionText({ instance, number, text })
  if (!ok) {
    await supabase
      .from('usuarios')
      .update({ reset_token_hash: null, reset_token_expires_at: null, reset_token_created_at: null })
      .eq('id', userId)
    const e = new Error('Não foi possível enviar o código pelo WhatsApp. Tente de novo em instantes.')
    e.statusCode = 502
    throw e
  }

  log.info('[registration-otp] OTP enviado', { userId, number: number.slice(0, 4) + '…' + number.slice(-2) })
  return { sent: true, number }
}

/**
 * Verifica o OTP de cadastro e marca telefone_verificado = true.
 * Lança erro com .statusCode em caso de código inválido/expirado.
 */
export async function verifyRegistrationOtp(userId, otpRaw) {
  const otp = String(otpRaw || '').replace(/\D/g, '')
  if (otp.length !== OTP_LENGTH) {
    const e = new Error('Informe o código de 6 dígitos enviado pelo WhatsApp.')
    e.statusCode = 400
    throw e
  }

  const supabase = getSupabaseAdmin()
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('id, reset_token_hash, reset_token_expires_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!user?.reset_token_hash) {
    const e = new Error('Código inválido ou expirado. Solicite um novo código.')
    e.statusCode = 400
    throw e
  }
  if (!user.reset_token_expires_at || new Date(user.reset_token_expires_at) <= new Date()) {
    const e = new Error('Código expirado. Clique em "Reenviar código".')
    e.statusCode = 400
    throw e
  }

  const expectedHash = hashOtp(userId, otp)
  if (expectedHash !== user.reset_token_hash) {
    const e = new Error('Código incorreto. Verifique e tente novamente.')
    e.statusCode = 400
    throw e
  }

  const { error: upErr } = await supabase
    .from('usuarios')
    .update({
      telefone_verificado: true,
      reset_token_hash: null,
      reset_token_expires_at: null,
      reset_token_created_at: null,
    })
    .eq('id', userId)
  if (upErr) throw upErr

  return { ok: true }
}

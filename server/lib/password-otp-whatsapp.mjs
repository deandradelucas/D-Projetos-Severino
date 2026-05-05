import crypto from 'node:crypto'
import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { sendEvolutionText, evolutionEnvConfigured } from './evolution-send.mjs'
import { normalizarDigitosWhatsappLog } from './usuarios.mjs'
import { isValidEmail } from './password-reset.mjs'

const OTP_WINDOW_MS = 15 * 60 * 1000
const OTP_LENGTH = 6

function otpPepper() {
  return String(process.env.PASSWORD_OTP_PEPPER || process.env.HORIZONTE_OTP_PEPPER || 'horizonte-otp-v1')
}

function hashOtp(userId, otpRaw) {
  return crypto.createHash('sha256').update(`${otpPepper()}|${userId}|${otpRaw}`).digest('hex')
}

function generateOtpDigits() {
  const n = crypto.randomInt(0, 1_000_000)
  return String(n).padStart(OTP_LENGTH, '0')
}

/** Número para Evolution (somente dígitos, ex. 5511999999999). */
export function resolveWhatsAppNumberForUsuario(row) {
  if (!row || typeof row !== 'object') return ''
  const tel = normalizarDigitosWhatsappLog(row.telefone)
  if (tel) return tel
  return normalizarDigitosWhatsappLog(row.whatsapp_id)
}

async function fetchUsuarioByEmailForReset(email) {
  const supabase = getSupabaseAdmin()
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, telefone, whatsapp_id, is_active')
    .eq('email', normalizedEmail)
    .maybeSingle()
  if (error) throw error
  if (!data || data.is_active === false) return null
  return data
}

const PUBLIC_GENERIC_MESSAGE =
  'Se este e-mail estiver cadastrado com WhatsApp no perfil, enviamos um código de 6 dígitos. Validade: 15 minutos.'

/**
 * @param {string} email
 * @param {{ detailedErrors?: boolean }} [options] — admin: mensagens específicas
 */
export async function requestPasswordOtpWhatsApp(email, options = {}) {
  const detailed = options.detailedErrors === true

  if (!evolutionEnvConfigured()) {
    const e = new Error('WhatsApp (Evolution API) não está configurado no servidor (EVOLUTION_*).')
    e.statusCode = 503
    throw e
  }

  const user = await fetchUsuarioByEmailForReset(email)

  if (!user) {
    if (detailed) {
      const e = new Error('Usuário não encontrado.')
      e.statusCode = 404
      throw e
    }
    return { message: PUBLIC_GENERIC_MESSAGE, sent: false }
  }

  const number = resolveWhatsAppNumberForUsuario(user)
  if (!number) {
    log.info('[password-otp] sem telefone/whatsapp no cadastro', { userId: user.id })
    if (detailed) {
      const e = new Error('Cadastro sem telefone/WhatsApp. Atualize o telefone antes de enviar o código.')
      e.statusCode = 400
      throw e
    }
    return { message: PUBLIC_GENERIC_MESSAGE, sent: false }
  }

  const otp = generateOtpDigits()
  const tokenHash = hashOtp(user.id, otp)
  const expiresAt = new Date(Date.now() + OTP_WINDOW_MS).toISOString()
  const createdAt = new Date().toISOString()

  const supabase = getSupabaseAdmin()
  const { error: upErr } = await supabase
    .from('usuarios')
    .update({
      reset_token_hash: tokenHash,
      reset_token_expires_at: expiresAt,
      reset_token_created_at: createdAt,
    })
    .eq('id', user.id)

  if (upErr) throw upErr

  const instance = String(process.env.EVOLUTION_INSTANCE || '').trim()
  const text = `Horizonte Financeiro — código para redefinir sua senha: ${otp}\n\nVálido por 15 minutos. Se não foi você, ignore esta mensagem.`

  const ok = await sendEvolutionText({ instance, number, text })
  if (!ok) {
    await supabase
      .from('usuarios')
      .update({
        reset_token_hash: null,
        reset_token_expires_at: null,
        reset_token_created_at: null,
      })
      .eq('id', user.id)
    const e = new Error('Falha ao enviar pelo WhatsApp. Confira a Evolution API e tente de novo.')
    e.statusCode = 502
    throw e
  }

  return {
    message: detailed
      ? `Código enviado para o WhatsApp cadastrado (${number.slice(0, 4)}…${number.slice(-2)}).`
      : PUBLIC_GENERIC_MESSAGE,
    sent: true,
  }
}

export async function confirmPasswordOtpWhatsApp(email, otpRaw, newPassword) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const otp = String(otpRaw || '').replace(/\D/g, '')
  const password = String(newPassword || '')

  if (!isValidEmail(normalizedEmail)) {
    const e = new Error('Informe um e-mail válido.')
    e.statusCode = 400
    throw e
  }
  if (otp.length !== OTP_LENGTH) {
    const e = new Error('Informe o código de 6 dígitos enviado pelo WhatsApp.')
    e.statusCode = 400
    throw e
  }
  if (password.length < 6) {
    const e = new Error('A senha deve ter no mínimo 6 caracteres.')
    e.statusCode = 400
    throw e
  }

  const supabase = getSupabaseAdmin()
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('id, email, reset_token_hash, reset_token_expires_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error) throw error
  if (!user?.reset_token_hash) {
    const e = new Error('Código inválido ou expirado. Solicite um novo código.')
    e.statusCode = 400
    throw e
  }

  if (!user.reset_token_expires_at || new Date(user.reset_token_expires_at) <= new Date()) {
    const e = new Error('Código expirado. Solicite um novo pelo WhatsApp.')
    e.statusCode = 400
    throw e
  }

  const expectedHash = hashOtp(user.id, otp)
  if (expectedHash !== user.reset_token_hash) {
    const e = new Error('Código incorreto.')
    e.statusCode = 400
    throw e
  }

  const { error: upErr } = await supabase
    .from('usuarios')
    .update({
      senha: password,
      reset_token_hash: null,
      reset_token_expires_at: null,
      reset_token_created_at: null,
    })
    .eq('id', user.id)

  if (upErr) throw upErr
  return { ok: true }
}

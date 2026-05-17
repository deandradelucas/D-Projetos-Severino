import nodemailer from 'nodemailer'
import { log } from './logger.mjs'
import { Alerts } from './notify-telegram.mjs'

export function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS,
  )
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT) || 465
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

function fromAddress() {
  return process.env.SMTP_FROM || `Severino <${process.env.SMTP_USER}>`
}

/**
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 * @returns {Promise<boolean>}
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!smtpConfigured()) {
    log.warn('[email-sender] SMTP não configurado — e-mail não enviado', { to, subject })
    return false
  }
  try {
    const transporter = createTransport()
    await transporter.sendMail({ from: fromAddress(), to, subject, html, text })
    return true
  } catch (err) {
    log.error('[email-sender] falha ao enviar e-mail', { to, subject, error: err?.message })
    void Alerts.smtpFail({ to, subject, error: err?.message }).catch(() => {})
    return false
  }
}

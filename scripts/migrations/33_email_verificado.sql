-- Migration 33: verificação de e-mail via OTP
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS email_verificado     BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_otp_hash       TEXT,
  ADD COLUMN IF NOT EXISTS email_otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_otp_created_at TIMESTAMPTZ;

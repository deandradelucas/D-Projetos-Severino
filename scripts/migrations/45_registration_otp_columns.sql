-- Colunas dedicadas ao OTP de registro (WhatsApp), separadas do OTP de reset de senha.
-- Evita colisão de tokens: um OTP de reset não pode ser usado para confirmar cadastro e vice-versa.
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS registration_token_hash       TEXT,
  ADD COLUMN IF NOT EXISTS registration_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_token_created_at TIMESTAMPTZ;

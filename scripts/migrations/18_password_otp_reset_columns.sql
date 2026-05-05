-- OTP de redefinição de senha via WhatsApp (hashes em reset_token_*)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS reset_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reset_token_created_at TIMESTAMPTZ;

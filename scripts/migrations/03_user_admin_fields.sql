-- Campos extras para painel de administração de usuários
-- Execute este script no Supabase (SQL editor) depois de aplicar os anteriores.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;


-- Isenção de pagamento (Mercado Pago / plano): admin marca na tela de logs ou em usuários.
-- Execute no SQL Editor do Supabase.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS isento_pagamento BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.usuarios.isento_pagamento IS 'Se true, não deve concluir checkout; uso administrativo.';

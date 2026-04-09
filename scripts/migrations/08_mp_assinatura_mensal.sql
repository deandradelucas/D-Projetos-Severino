-- Assinatura mensal Mercado Pago (preapproval): próxima cobrança e vínculo na conta do usuário.
-- Rode no SQL Editor do Supabase (idempotente).

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS mp_preapproval_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS assinatura_proxima_cobranca TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinatura_mp_status VARCHAR(32);

COMMENT ON COLUMN public.usuarios.mp_preapproval_id IS 'ID da assinatura (preapproval) no Mercado Pago.';
COMMENT ON COLUMN public.usuarios.assinatura_proxima_cobranca IS 'Próxima data de cobrança recorrente informada pelo MP.';
COMMENT ON COLUMN public.usuarios.assinatura_mp_status IS 'Status da assinatura no MP (authorized, pending, paused, cancelled).';

ALTER TABLE public.pagamentos_mercadopago
  ADD COLUMN IF NOT EXISTS preapproval_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_pagamentos_mp_preapproval ON public.pagamentos_mercadopago(preapproval_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_mp_preapproval ON public.usuarios(mp_preapproval_id);

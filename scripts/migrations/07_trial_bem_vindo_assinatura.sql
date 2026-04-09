-- Trial de 7 dias e controle da tela inicial de assinatura (Mercado Pago).
-- Execute no SQL Editor do Supabase após as migrations anteriores.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bem_vindo_pagamento_visto_at TIMESTAMPTZ;

COMMENT ON COLUMN public.usuarios.trial_ends_at IS 'Fim do período de teste (7 dias a partir do primeiro login); NULL até o primeiro login.';
COMMENT ON COLUMN public.usuarios.bem_vindo_pagamento_visto_at IS 'Quando o usuário dispensou a tela de boas-vindas / assinatura.';

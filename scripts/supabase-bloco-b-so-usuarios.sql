-- Bloco B apenas: trial + boas-vindas em usuarios
-- Supabase → SQL → New query → Run

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bem_vindo_pagamento_visto_at TIMESTAMPTZ;

COMMENT ON COLUMN public.usuarios.trial_ends_at IS 'Fim do período de teste (7 dias a partir do primeiro login); NULL até o primeiro login.';
COMMENT ON COLUMN public.usuarios.bem_vindo_pagamento_visto_at IS 'Quando o usuário dispensou a tela de boas-vindas / assinatura.';

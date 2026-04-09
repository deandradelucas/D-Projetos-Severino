-- =============================================================================
-- Cole no Supabase: Project → SQL → New query → Run
-- =============================================================================
-- 1) Se você AINDA NÃO criou a tabela do Mercado Pago, rode o BLOCO A.
-- 2) Para trial de 7 dias + tela de boas-vindas, rode o BLOCO B (sempre).
-- =============================================================================

-- ----- BLOCO A: pagamentos Mercado Pago (idempotente; seguro rodar de novo) -----
CREATE TABLE IF NOT EXISTS public.pagamentos_mercadopago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  preference_id VARCHAR(64),
  payment_id VARCHAR(64),
  status VARCHAR(32),
  status_detail VARCHAR(128),
  amount DECIMAL(12, 2),
  currency_id VARCHAR(8) DEFAULT 'BRL',
  description TEXT,
  external_reference TEXT,
  payer_email VARCHAR(255),
  raw_payment JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_mp_preference ON public.pagamentos_mercadopago(preference_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_mp_payment ON public.pagamentos_mercadopago(payment_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_mp_usuario ON public.pagamentos_mercadopago(usuario_id);

ALTER TABLE public.pagamentos_mercadopago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir SELECT pagamentos autenticados" ON public.pagamentos_mercadopago;
DROP POLICY IF EXISTS "Pagamentos leitura só do dono" ON public.pagamentos_mercadopago;

CREATE POLICY "Pagamentos leitura só do dono"
  ON public.pagamentos_mercadopago FOR SELECT TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

COMMENT ON TABLE public.pagamentos_mercadopago IS 'Registros de preferências e pagamentos Mercado Pago';

-- ----- BLOCO B: colunas de trial / boas-vindas em usuarios (obrigatório p/ assinatura) -----
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bem_vindo_pagamento_visto_at TIMESTAMPTZ;

COMMENT ON COLUMN public.usuarios.trial_ends_at IS 'Fim do período de teste (7 dias a partir do primeiro login); NULL até o primeiro login.';
COMMENT ON COLUMN public.usuarios.bem_vindo_pagamento_visto_at IS 'Quando o usuário dispensou a tela de boas-vindas / assinatura.';

-- ----- BLOCO C: assinatura mensal MP (preapproval) + coluna em pagamentos -----
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS mp_preapproval_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS assinatura_proxima_cobranca TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinatura_mp_status VARCHAR(32);

ALTER TABLE public.pagamentos_mercadopago
  ADD COLUMN IF NOT EXISTS preapproval_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_pagamentos_mp_preapproval ON public.pagamentos_mercadopago(preapproval_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_mp_preapproval ON public.usuarios(mp_preapproval_id);

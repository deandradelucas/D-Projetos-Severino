-- Asaas: substitui Mercado Pago (checkout + assinatura + webhooks).
-- Rode no SQL Editor do Supabase após backup se precisar dos dados antigos do MP.

-- Novos campos no usuário (titular / cobrança)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS asaas_subscription_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS assinatura_asaas_status VARCHAR(32);

COMMENT ON COLUMN public.usuarios.asaas_customer_id IS 'ID do cliente (cus_) no Asaas.';
COMMENT ON COLUMN public.usuarios.asaas_subscription_id IS 'ID da assinatura (sub_) no Asaas.';
COMMENT ON COLUMN public.usuarios.assinatura_asaas_status IS 'Status da assinatura no Asaas: ACTIVE, INACTIVE, EXPIRED.';

-- Remove colunas Mercado Pago (vínculo na assinatura)
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS mp_preapproval_id;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS assinatura_mp_status;

DROP INDEX IF EXISTS idx_usuarios_mp_preapproval;

-- Tabela de cobranças / checkouts Asaas
CREATE TABLE IF NOT EXISTS public.pagamentos_asaas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  checkout_id VARCHAR(64),
  subscription_id VARCHAR(64),
  payment_id VARCHAR(64),
  status VARCHAR(64),
  status_detail VARCHAR(256),
  amount DECIMAL(12, 2),
  currency_id VARCHAR(8) DEFAULT 'BRL',
  description TEXT,
  external_reference TEXT,
  payer_email VARCHAR(255),
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_asaas_checkout ON public.pagamentos_asaas(checkout_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_asaas_subscription ON public.pagamentos_asaas(subscription_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_asaas_payment ON public.pagamentos_asaas(payment_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_asaas_usuario ON public.pagamentos_asaas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_asaas_external_ref ON public.pagamentos_asaas(external_reference);

ALTER TABLE public.pagamentos_asaas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pagamentos Asaas leitura só do dono" ON public.pagamentos_asaas;

CREATE POLICY "Pagamentos Asaas leitura só do dono"
  ON public.pagamentos_asaas FOR SELECT TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

COMMENT ON TABLE public.pagamentos_asaas IS 'Checkouts e cobranças Asaas (service_role na API ignora RLS).';

-- Remove legado Mercado Pago
DROP TABLE IF EXISTS public.pagamentos_mercadopago;

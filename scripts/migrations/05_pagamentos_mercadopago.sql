-- Tabela de pagamentos Mercado Pago (preferências + webhooks).
-- OBRIGATÓRIO: execute no SQL Editor do Supabase (Project → SQL → New query).
-- Sem esta tabela, a API retorna: "Could not find the table 'public.pagamentos_mercadopago' in the schema cache".

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

-- JWT com auth.uid() = usuario_id; API Node (service_role) ignora RLS
CREATE POLICY "Pagamentos leitura só do dono"
  ON public.pagamentos_mercadopago FOR SELECT TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

COMMENT ON TABLE public.pagamentos_mercadopago IS 'Registros de preferências e pagamentos Mercado Pago';

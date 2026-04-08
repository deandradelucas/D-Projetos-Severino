-- Pagamentos Mercado Pago (preferências + pagamentos confirmados)
-- Execute no Supabase após migrations anteriores.

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

-- Stripe Checkout (assinatura cartão) em paralelo ao Asaas (ex.: Pix anual).
-- Rode no SQL Editor do Supabase após revisar.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS stripe_subscription_status VARCHAR(32);

COMMENT ON COLUMN public.usuarios.stripe_customer_id IS 'ID do cliente (cus_) no Stripe.';
COMMENT ON COLUMN public.usuarios.stripe_subscription_id IS 'ID da assinatura (sub_) no Stripe.';
COMMENT ON COLUMN public.usuarios.stripe_subscription_status IS 'Status da assinatura no Stripe: active, trialing, canceled, past_due, etc.';

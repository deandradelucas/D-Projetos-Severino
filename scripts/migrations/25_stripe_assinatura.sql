-- ============================================================================
-- OBSOLETA — Stripe foi descontinuado em favor de Asaas (Pix mensal/anual).
-- As colunas abaixo NÃO foram aplicadas no banco de produção e o código em
-- `server/lib/assinatura-guard.mjs` / `assinatura-db.mjs` agora pula o SELECT
-- de colunas Stripe quando STRIPE_SECRET_KEY está vazio (`isStripeConfigured()`).
-- Mantida no histórico para o caso de Stripe ser re-ativado no futuro.
-- ============================================================================
-- Stripe Checkout (assinatura cartão) em paralelo ao Asaas (ex.: Pix anual).
-- Rode no SQL Editor do Supabase APENAS se voltar a ativar Stripe.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS stripe_subscription_status VARCHAR(32);

COMMENT ON COLUMN public.usuarios.stripe_customer_id IS 'ID do cliente (cus_) no Stripe.';
COMMENT ON COLUMN public.usuarios.stripe_subscription_id IS 'ID da assinatura (sub_) no Stripe.';
COMMENT ON COLUMN public.usuarios.stripe_subscription_status IS 'Status da assinatura no Stripe: active, trialing, canceled, past_due, etc.';

-- Tabela `refresh_tokens` (rotação JWT, TTL 30 dias).
-- Aplicada manualmente em produção via Supabase CLI antes desta versão estar
-- versionada no repo (registo do _supabase_migrations: 20260515193421
-- create_refresh_tokens). Este arquivo formaliza o schema atual; é idempotente
-- para permitir reaplicação em ambientes novos.
--
-- ATENÇÃO: a tabela está com RLS DESABILITADO em produção (advisory
-- supabase rls_disabled, prioridade 1). A API só toca esta tabela via
-- service_role, então RLS não é bloqueio funcional, mas convém habilitar
-- com policies restritas em revisão de segurança futura.

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_usuario_id_idx
  ON public.refresh_tokens (usuario_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx
  ON public.refresh_tokens (expires_at);

COMMENT ON TABLE public.refresh_tokens
  IS 'Tokens de refresh JWT com rotação. TTL 30 dias. Deletar expirados periodicamente.';

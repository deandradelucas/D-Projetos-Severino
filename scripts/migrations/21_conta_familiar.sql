-- Conta familiar: membros com login próprio compartilham dados do titular (transações, agenda, etc.).
-- Convites com token hash + expiração; papel VIEWER = só leitura na API.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS vinculo_conta_principal_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS familia_papel TEXT;

COMMENT ON COLUMN public.usuarios.vinculo_conta_principal_id IS 'Se preenchido, este usuário usa os dados financeiros/agenda do usuário referenciado (titular).';
COMMENT ON COLUMN public.usuarios.familia_papel IS 'Papel na conta compartilhada: ADMIN, MEMBER ou VIEWER (VIEWER sem escrita na API).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_familia_papel_check'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_familia_papel_check
      CHECK (familia_papel IS NULL OR familia_papel IN ('ADMIN', 'MEMBER', 'VIEWER'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuarios_vinculo_conta_principal
  ON public.usuarios(vinculo_conta_principal_id)
  WHERE vinculo_conta_principal_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.familia_convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  papel_convite TEXT NOT NULL DEFAULT 'MEMBER'
    CHECK (papel_convite IN ('ADMIN', 'MEMBER', 'VIEWER')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL,
  consumed_at TIMESTAMPTZ NULL,
  consumed_by_usuario_id UUID NULL REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_familia_convites_titular
  ON public.familia_convites(titular_usuario_id);

CREATE INDEX IF NOT EXISTS idx_familia_convites_expires
  ON public.familia_convites(expires_at)
  WHERE revoked_at IS NULL AND consumed_at IS NULL;

COMMENT ON TABLE public.familia_convites IS 'Convites para vincular um usuário à conta familiar do titular; token armazenado só como hash.';

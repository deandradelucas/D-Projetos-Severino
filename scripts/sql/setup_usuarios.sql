-- Execute este SQL no editor SQL do Supabase Dashboard
-- Ele cria a tabela usuarios com a mesma estrutura esperada pelo front-end.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  reset_token_hash TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  reset_token_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir atualização" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir delete" ON public.usuarios;
DROP POLICY IF EXISTS "Anon pode cadastrar usuário" ON public.usuarios;
DROP POLICY IF EXISTS "Authenticated pode cadastrar usuário" ON public.usuarios;

-- Cadastro público; leitura/alteração de perfil só pela API (service role).
CREATE POLICY "Anon pode cadastrar usuário" ON public.usuarios
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated pode cadastrar usuário" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Execute este SQL no editor SQL do Supabase Dashboard
-- Ele cria a tabela usuarios com a mesma estrutura esperada pelo front-end.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir atualização" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir delete" ON public.usuarios;

CREATE POLICY "Permitir inserção" ON public.usuarios
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir leitura" ON public.usuarios
  FOR SELECT
  USING (true);

CREATE POLICY "Permitir atualização" ON public.usuarios
  FOR UPDATE
  USING (true);

CREATE POLICY "Permitir delete" ON public.usuarios
  FOR DELETE
  USING (true);

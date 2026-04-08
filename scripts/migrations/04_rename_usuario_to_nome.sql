-- Alinha schema legado: coluna `usuario` → `nome` (compatível com o app atual).
-- Execute no SQL Editor do Supabase se o login/admin falhar com erro 42703 citando "usuario".

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
      AND column_name = 'usuario'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
      AND column_name = 'nome'
  ) THEN
    ALTER TABLE public.usuarios RENAME COLUMN usuario TO nome;
  END IF;
END $$;

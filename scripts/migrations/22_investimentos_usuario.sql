-- Cadastro simples de tipos de investimento por usuário (LCA, LCI, CDB, CDI, Poupança ou nome próprio).
-- A API Node usa service role; RLS alinha-se ao padrão de agenda para eventual uso via PostgREST autenticado.

CREATE TABLE IF NOT EXISTS public.investimentos_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo_preset TEXT NULL,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT investimentos_usuario_tipo_preset_check CHECK (
    tipo_preset IS NULL OR tipo_preset IN ('LCA', 'LCI', 'CDB', 'CDI', 'POUPANCA')
  ),
  CONSTRAINT investimentos_usuario_nome_len CHECK (char_length(trim(nome)) >= 1 AND char_length(nome) <= 120)
);

CREATE INDEX IF NOT EXISTS idx_investimentos_usuario_usuario_criado
  ON public.investimentos_usuario (usuario_id, criado_em DESC);

COMMENT ON TABLE public.investimentos_usuario IS
  'Tipos/linhas de investimento declarados pelo usuário (preset ou nome livre).';

ALTER TABLE public.investimentos_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investimentos_usuario_só_do_dono" ON public.investimentos_usuario;
CREATE POLICY "investimentos_usuario_só_do_dono"
  ON public.investimentos_usuario
  FOR ALL
  TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id)
  WITH CHECK (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

-- Regras de lançamento automático no dia 1 de cada mês (ex.: Netflix, salário).
-- Execute no SQL Editor do Supabase na ordem numérica.

CREATE TABLE IF NOT EXISTS public.recorrencias_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('DESPESA', 'RECEITA')),
  valor DECIMAL(14, 2) NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  subcategoria_id UUID REFERENCES public.subcategorias(id) ON DELETE SET NULL,
  dia_mes SMALLINT NOT NULL DEFAULT 1 CHECK (dia_mes = 1),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_geracao_mes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recorrencias_mensais_usuario_ativo
  ON public.recorrencias_mensais (usuario_id)
  WHERE ativo = true;

COMMENT ON TABLE public.recorrencias_mensais IS
  'Repetir lançamento no dia 1 de cada mês; ultima_geracao_mes = YYYY-MM do último mês já gerado automaticamente.';
COMMENT ON COLUMN public.recorrencias_mensais.ultima_geracao_mes IS
  'YYYY-MM do último mês em que foi criada transação (manual inicial ou automática).';

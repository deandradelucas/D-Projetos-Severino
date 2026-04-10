-- Liga transações à regra de lançamento mensal (para exibir ícone na lista).
-- Execute no SQL Editor do Supabase após 10_recorrencias_mensais.sql.

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS recorrencia_mensal_id UUID REFERENCES public.recorrencias_mensais(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_recorrencia_mensal
  ON public.transacoes (recorrencia_mensal_id)
  WHERE recorrencia_mensal_id IS NOT NULL;

COMMENT ON COLUMN public.transacoes.recorrencia_mensal_id IS
  'Preenchido quando o lançamento foi criado a partir de uma regra de recorrência mensal (ex.: dia 1).';

-- Adiciona suporte a limite de meses nas recorrências mensais.
-- total_meses NULL = tempo indeterminado (comportamento existente).
-- mes_inicio = YYYY-MM da primeira transação (para calcular meses gerados).

ALTER TABLE public.recorrencias_mensais
  ADD COLUMN IF NOT EXISTS total_meses SMALLINT DEFAULT NULL
    CHECK (total_meses IS NULL OR total_meses >= 2),
  ADD COLUMN IF NOT EXISTS mes_inicio TEXT DEFAULT NULL;

COMMENT ON COLUMN public.recorrencias_mensais.total_meses IS
  'Número total de meses da recorrência incluindo o lançamento inicial (NULL = indeterminado).';
COMMENT ON COLUMN public.recorrencias_mensais.mes_inicio IS
  'YYYY-MM do lançamento inicial (mês 1 de total_meses). Igual a ultima_geracao_mes no momento da criação.';

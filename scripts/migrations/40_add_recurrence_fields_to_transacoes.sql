-- Campos para rastrear instâncias de parcelamento/recorrência gerada
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS recorrente_grupo_id UUID,
  ADD COLUMN IF NOT EXISTS recorrente_index    INTEGER,
  ADD COLUMN IF NOT EXISTS recorrente_total    INTEGER;

COMMENT ON COLUMN public.transacoes.recorrente_grupo_id IS 'ID para agrupar instâncias de uma mesma recorrência/parcelamento';
COMMENT ON COLUMN public.transacoes.recorrente_index    IS 'Índice da parcela (ex: 2 de 12)';
COMMENT ON COLUMN public.transacoes.recorrente_total    IS 'Total de parcelas (ex: 12)';

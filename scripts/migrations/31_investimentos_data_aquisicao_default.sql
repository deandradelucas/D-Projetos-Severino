-- Garante valor em INSERTs que omitirem a coluna (clientes antigos / integrações).
ALTER TABLE public.investimentos_usuario
  ALTER COLUMN data_aquisicao SET DEFAULT (CURRENT_DATE);

COMMENT ON COLUMN public.investimentos_usuario.data_aquisicao IS
  'Data da aquisição da posição (calendar date). Omisão no INSERT usa CURRENT_DATE.';

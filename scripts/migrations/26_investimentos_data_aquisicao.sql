-- Data em que o investimento foi adquirido (IR regressivo e exibição na carteira).

ALTER TABLE public.investimentos_usuario
  ADD COLUMN IF NOT EXISTS data_aquisicao DATE;

UPDATE public.investimentos_usuario
SET data_aquisicao = (criado_em AT TIME ZONE 'UTC')::date
WHERE data_aquisicao IS NULL;

ALTER TABLE public.investimentos_usuario
  ALTER COLUMN data_aquisicao SET NOT NULL;

COMMENT ON COLUMN public.investimentos_usuario.data_aquisicao IS
  'Data da aquisição da posição (calendar date), informada pelo utilizador.';

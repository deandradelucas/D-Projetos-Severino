-- Percentual do CDI contratado na aplicação (ex.: 110 = 110% do CDI).

ALTER TABLE public.investimentos_usuario
  ADD COLUMN IF NOT EXISTS percentual_cdi NUMERIC(8, 4);

ALTER TABLE public.investimentos_usuario
  DROP CONSTRAINT IF EXISTS investimentos_percentual_cdi_check;

ALTER TABLE public.investimentos_usuario
  ADD CONSTRAINT investimentos_percentual_cdi_check CHECK (
    percentual_cdi IS NULL OR (percentual_cdi >= 0.01 AND percentual_cdi <= 9999.99)
  );

COMMENT ON COLUMN public.investimentos_usuario.percentual_cdi IS
  'Percentual do CDI contratado (%), referência declarada pelo usuário.';

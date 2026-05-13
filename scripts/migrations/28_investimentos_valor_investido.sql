-- Valor aplicado declarado pelo usuário (referência em BRL).

ALTER TABLE public.investimentos_usuario
  ADD COLUMN IF NOT EXISTS valor_investido NUMERIC(14, 2);

ALTER TABLE public.investimentos_usuario
  DROP CONSTRAINT IF EXISTS investimentos_valor_investido_check;

ALTER TABLE public.investimentos_usuario
  ADD CONSTRAINT investimentos_valor_investido_check CHECK (
    valor_investido IS NULL OR (valor_investido >= 0.01 AND valor_investido <= 999999999999.99)
  );

COMMENT ON COLUMN public.investimentos_usuario.valor_investido IS
  'Valor investido informado pelo usuário (BRL); opcional para linhas antigas.';

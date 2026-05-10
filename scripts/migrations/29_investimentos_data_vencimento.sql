-- Data de vencimento do investimento (opcional).
-- Permite ao app mostrar "faltam X dias", alertas de prazo e pré-preencher o simulador.

ALTER TABLE public.investimentos_usuario
  ADD COLUMN IF NOT EXISTS data_vencimento DATE NULL;

COMMENT ON COLUMN public.investimentos_usuario.data_vencimento IS
  'Data de vencimento do investimento (opcional). NULL = sem vencimento definido ou sem prazo fixo.';

-- Aportes adicionais em investimentos de renda fixa.
-- Cada aporte tem seu próprio timer de IR regressivo (data_aquisicao individual).

CREATE TABLE IF NOT EXISTS public.investimento_aportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investimento_id UUID NOT NULL REFERENCES public.investimentos_usuario(id) ON DELETE CASCADE,
  valor NUMERIC(15,2) NOT NULL CHECK (valor >= 0.01),
  data_aquisicao DATE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investimento_aportes_investimento
  ON public.investimento_aportes(investimento_id);

COMMENT ON TABLE public.investimento_aportes IS
  'Aportes individuais de cada investimento. Cada aporte tem sua própria data de entrada e cálculo de IR regressivo independente.';

-- Backfill: criar 1 aporte inicial por investimento existente com valor e data_aquisicao atuais
INSERT INTO public.investimento_aportes (investimento_id, valor, data_aquisicao, criado_em)
SELECT
  id,
  COALESCE(valor_investido, 0.01),
  COALESCE(data_aquisicao, criado_em::DATE, CURRENT_DATE),
  COALESCE(criado_em, NOW())
FROM public.investimentos_usuario
WHERE valor_investido IS NOT NULL AND valor_investido >= 0.01
ON CONFLICT DO NOTHING;

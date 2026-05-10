-- Indexador da linha: CDI (pós-fixado, percentual_cdi = % do CDI) ou PREFIXADO (taxa a.a. em percentual_cdi).

ALTER TABLE public.investimentos_usuario
  ADD COLUMN IF NOT EXISTS tipo_indexador TEXT DEFAULT 'CDI';

UPDATE public.investimentos_usuario
SET tipo_indexador = 'CDI'
WHERE tipo_indexador IS NULL;

ALTER TABLE public.investimentos_usuario
  ALTER COLUMN tipo_indexador SET DEFAULT 'CDI';

ALTER TABLE public.investimentos_usuario
  ALTER COLUMN tipo_indexador SET NOT NULL;

ALTER TABLE public.investimentos_usuario
  DROP CONSTRAINT IF EXISTS investimentos_usuario_tipo_indexador_check;

ALTER TABLE public.investimentos_usuario
  ADD CONSTRAINT investimentos_usuario_tipo_indexador_check CHECK (
    tipo_indexador IN ('CDI', 'PREFIXADO')
  );

COMMENT ON COLUMN public.investimentos_usuario.tipo_indexador IS
  'CDI = pós-fixado; PREFIXADO = taxa pré-fixada anual em percentual_cdi.';

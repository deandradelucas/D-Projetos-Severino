-- Banco / cooperativa / corretora por linha de investimento (expande investimentos_usuario).

ALTER TABLE public.investimentos_usuario
  ADD COLUMN IF NOT EXISTS instituicao_nome TEXT;

UPDATE public.investimentos_usuario
SET instituicao_nome = 'Não informado'
WHERE instituicao_nome IS NULL OR trim(instituicao_nome) = '';

ALTER TABLE public.investimentos_usuario
  ALTER COLUMN instituicao_nome SET NOT NULL;

ALTER TABLE public.investimentos_usuario
  DROP CONSTRAINT IF EXISTS investimentos_instituicao_len;

ALTER TABLE public.investimentos_usuario
  ADD CONSTRAINT investimentos_instituicao_len CHECK (
    char_length(trim(instituicao_nome)) >= 2 AND char_length(instituicao_nome) <= 120
  );

COMMENT ON COLUMN public.investimentos_usuario.instituicao_nome IS
  'Instituição onde o investimento está custodiado (banco, cooperativa ou corretora).';

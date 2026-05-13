-- Quem lançou a transação (conta familiar): membro com login próprio.
-- Null = titular / lançamento antes da migração / sistema (ex.: recorrência automática).

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS lancado_por_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_lancado_por_usuario_id
  ON public.transacoes(lancado_por_usuario_id)
  WHERE lancado_por_usuario_id IS NOT NULL;

COMMENT ON COLUMN public.transacoes.lancado_por_usuario_id IS 'Usuário que registrou o lançamento (membro familiar); NULL se titular ou legado.';

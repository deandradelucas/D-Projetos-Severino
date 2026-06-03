-- Cartões de crédito + vínculo com transações.
-- Escopo família: usuario_id guarda o titular quando o cartão é familiar (mesmo padrão das metas/listas).
-- A fatura é computada dinamicamente pelo ciclo de fechamento (não há tabela de fatura).

CREATE TABLE IF NOT EXISTS public.cartoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 60),
  bandeira TEXT,                       -- visa | master | elo | amex | hipercard | outro
  cor TEXT NOT NULL DEFAULT 'gold',
  limite NUMERIC(14,2),                -- opcional
  dia_fechamento SMALLINT NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento SMALLINT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  arquivado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cartoes_usuario_ativos
  ON public.cartoes(usuario_id) WHERE arquivado_em IS NULL;

-- Vínculo opcional: despesa lançada em um cartão de crédito.
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS cartao_id UUID REFERENCES public.cartoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_cartao
  ON public.transacoes(cartao_id) WHERE cartao_id IS NOT NULL;

COMMENT ON TABLE public.cartoes IS
  'Cartões de crédito do usuário. Fatura computada pelo ciclo (dia_fechamento). Escopo família via usuario_id do titular.';
COMMENT ON COLUMN public.transacoes.cartao_id IS
  'Cartão de crédito em que a despesa foi lançada (NULL = não é despesa de cartão).';

-- RLS no padrão do projeto: habilitado sem policy (backend usa service role; anon key bloqueada).
ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;

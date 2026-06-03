-- Metas / objetivos financeiros (ex.: "juntar R$ 5.000 pra viagem", "reserva de emergência").
-- Escopo família: usuario_id guarda o titular quando a meta é familiar — mesmo padrão das
-- listas de compras (pessoal = actorId; família = dataUsuarioId do titular).

CREATE TABLE IF NOT EXISTS public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 80),
  icone TEXT NOT NULL DEFAULT '🎯',
  cor TEXT NOT NULL DEFAULT 'gold',
  valor_alvo NUMERIC(14,2) NOT NULL CHECK (valor_alvo >= 0.01),
  valor_guardado NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_guardado >= 0),
  prazo DATE,
  concluida_em TIMESTAMPTZ,
  arquivada_em TIMESTAMPTZ,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metas_usuario_ativas
  ON public.metas(usuario_id) WHERE arquivada_em IS NULL;

CREATE TABLE IF NOT EXISTS public.meta_aportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id UUID NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  valor NUMERIC(14,2) NOT NULL CHECK (valor <> 0),  -- positivo = guardar; negativo = resgatar
  nota TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_aportes_meta
  ON public.meta_aportes(meta_id);

COMMENT ON TABLE public.metas IS
  'Metas/objetivos financeiros (juntar dinheiro). Escopo família via usuario_id do titular.';
COMMENT ON TABLE public.meta_aportes IS
  'Histórico de aportes (guardar/resgatar) de cada meta.';

-- RLS no padrão do projeto: habilitado sem policy. O backend acessa via service role
-- (ignora RLS); a anon/public key fica bloqueada (não expõe dados financeiros via PostgREST).
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_aportes ENABLE ROW LEVEL SECURITY;

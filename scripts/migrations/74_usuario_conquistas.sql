-- Migration 74: conquistas de gamificação (Story F2 — fase 1 MVP)
-- Registra os selos que cada usuário (ou titular de família) desbloqueou.
-- A elegibilidade é DERIVADA do estado (metas/aportes/transações) em
-- GET /api/gamificacao; esta tabela apenas PERSISTE o desbloqueio para que
-- a conquista seja permanente mesmo que o valor caia depois (ex.: resgatar
-- de uma meta não remove o selo "R$ 1 mil guardado").

CREATE TABLE IF NOT EXISTS public.usuario_conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  conquista_key text NOT NULL,
  unlocked_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, conquista_key)
);

-- Padrão do projeto: RLS habilitado sem policy = deny-all para anon/authenticated;
-- o acesso é exclusivo via service_role (backend).
ALTER TABLE public.usuario_conquistas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_usuario_conquistas_usuario
  ON public.usuario_conquistas (usuario_id);

COMMENT ON TABLE public.usuario_conquistas IS
  'Conquistas desbloqueadas (gamificação F2). Elegibilidade derivada do estado; esta tabela torna o desbloqueio permanente.';

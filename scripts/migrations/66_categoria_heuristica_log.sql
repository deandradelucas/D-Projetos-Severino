-- Migration 66: instrumentação (medição #3) — log de quando a heurística sobrepõe
-- a categoria do LLM. ANÔNIMA (sem usuario_id) — é dado agregado de medição, não PII
-- ligada a usuário. TEMPORÁRIA: analisar em ~1-2 semanas e DROPAR (decidir corte da heurística).
-- Aplicar MANUALMENTE em produção (ref zesyderishnbjrpfbmqa).

CREATE TABLE IF NOT EXISTS public.categoria_heuristica_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text,
  cat_llm text,
  cat_heuristica text,
  tipo text,
  created_at timestamptz DEFAULT now()
);

-- Convenção do projeto: RLS habilitado SEM policy (backend via service_role).
ALTER TABLE public.categoria_heuristica_log ENABLE ROW LEVEL SECURITY;

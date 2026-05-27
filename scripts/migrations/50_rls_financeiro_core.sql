-- RLS deny-by-default nas tabelas financeiras core (Story 1.3).
--
-- A API Node (Hono) usa SUPABASE_SERVICE_ROLE_KEY e ignora RLS por design.
-- Sem políticas para anon/authenticated: PostgREST direto fica bloqueado se a anon key vazar.
-- subcategorias já tem políticas próprias em 09_rls_review / 43 (não alteradas aqui).

ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recorrencias_mensais ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'contas'
  ) THEN
    ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

COMMENT ON TABLE public.transacoes IS
  'Lançamentos financeiros. RLS habilitado; acesso via service_role na API.';

COMMENT ON TABLE public.categorias IS
  'Categorias por usuário. RLS habilitado; acesso via service_role na API.';

COMMENT ON TABLE public.recorrencias_mensais IS
  'Regras de recorrência mensal. RLS habilitado; acesso via service_role na API.';

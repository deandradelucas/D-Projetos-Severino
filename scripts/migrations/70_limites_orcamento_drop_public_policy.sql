-- limites_orcamento tinha a policy "service role full access limites" criada para
-- PUBLIC (sem `TO service_role`) com USING(true)/WITH CHECK(true) em ALL — o que
-- concedia acesso total (SELECT/INSERT/UPDATE/DELETE) a qualquer role, incluindo
-- anon/authenticated via a chave pública. O servidor usa service_role (ignora RLS),
-- então a policy é redundante E um furo de segurança.
-- Removida. Resta apenas "usuarios leem seus limites" (SELECT escopado por usuario_id).
-- Escritas continuam via service_role no backend (upsertLimiteOrcamento).

DROP POLICY IF EXISTS "service role full access limites" ON public.limites_orcamento;

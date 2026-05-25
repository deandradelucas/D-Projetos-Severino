-- Habilita RLS na tabela refresh_tokens (advisory rls_disabled, prioridade 1).
--
-- Contexto: a API toca refresh_tokens exclusivamente via service_role key
-- (server/lib/refresh-token.mjs), que ignora RLS por design do Supabase.
-- Sem RLS habilitado, qualquer chave anon poderia ler ou alterar tokens
-- diretamente — surface enorme de risco se a anon key vazar.
--
-- Habilito RLS sem nenhuma policy permissiva: o efeito e bloquear
-- completamente anon + authenticated, mantendo o acesso server-side
-- (service_role) intacto. E exatamente o comportamento que ja temos
-- na pratica; a migration apenas formaliza no DB.

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Sem policies: anon e authenticated nao tem acesso (deny by default).
-- Service role bypassa RLS automaticamente, entao a API continua funcionando.

COMMENT ON TABLE public.refresh_tokens
  IS 'Tokens de refresh JWT com rotacao. TTL 30 dias. RLS habilitado, acessado apenas via service_role.';

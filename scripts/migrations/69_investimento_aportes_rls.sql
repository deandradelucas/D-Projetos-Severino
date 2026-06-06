-- RLS faltante em investimento_aportes (criada em 34_investimento_aportes.sql sem RLS).
-- O servidor usa a service_role key (ignora RLS); esta policy protege contra uso da
-- anon/public key — alinhado ao padrão das demais tabelas financeiras (ver 26_investimentos_usuario.sql).
-- Dono resolvido via tabela pai investimentos_usuario.usuario_id = auth.uid().

ALTER TABLE public.investimento_aportes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aportes_via_investimento_do_usuario" ON public.investimento_aportes;
CREATE POLICY "aportes_via_investimento_do_usuario"
  ON public.investimento_aportes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.investimentos_usuario i
      WHERE i.id = investimento_aportes.investimento_id
        AND i.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.investimentos_usuario i
      WHERE i.id = investimento_aportes.investimento_id
        AND i.usuario_id = auth.uid()
    )
  );

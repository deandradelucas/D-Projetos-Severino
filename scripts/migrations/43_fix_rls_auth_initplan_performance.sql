-- Substituir auth.uid() por (select auth.uid()) em todas as políticas RLS.
-- Evita re-avaliação da função para cada linha — melhora plano de execução.
DROP POLICY IF EXISTS "Agenda leitura só do dono" ON public.agenda_eventos;
CREATE POLICY "Agenda leitura só do dono" ON public.agenda_eventos
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (usuario_id IS NOT NULL AND (select auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "investimentos_usuario_só_do_dono" ON public.investimentos_usuario;
CREATE POLICY "investimentos_usuario_só_do_dono" ON public.investimentos_usuario
  AS PERMISSIVE FOR ALL TO authenticated
  USING (usuario_id IS NOT NULL AND (select auth.uid()) = usuario_id)
  WITH CHECK (usuario_id IS NOT NULL AND (select auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "Pagamentos Asaas leitura só do dono" ON public.pagamentos_asaas;
CREATE POLICY "Pagamentos Asaas leitura só do dono" ON public.pagamentos_asaas
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (usuario_id IS NOT NULL AND (select auth.uid()) = usuario_id);

DROP POLICY IF EXISTS "subcategorias_via_categoria_do_usuario" ON public.subcategorias;
CREATE POLICY "subcategorias_via_categoria_do_usuario" ON public.subcategorias
  AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM categorias c
    WHERE c.id = subcategorias.categoria_id
      AND c.usuario_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM categorias c
    WHERE c.id = subcategorias.categoria_id
      AND c.usuario_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Logs WhatsApp leitura só do dono" ON public.whatsapp_logs;
CREATE POLICY "Logs WhatsApp leitura só do dono" ON public.whatsapp_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (usuario_id IS NOT NULL AND (select auth.uid()) = usuario_id);

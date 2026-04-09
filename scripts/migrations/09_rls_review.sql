-- Revisão RLS (Row Level Security): remove SELECT amplo para o papel authenticated.
-- A API Node usa SUPABASE_SERVICE_ROLE_KEY e ignora RLS.
-- O cadastro no front usa a chave anon com INSERT em public.usuarios (mantido).
-- JWT Supabase (auth.uid()) deve coincidir com usuarios.id para leituras diretas ao PostgREST.

-- ===== usuarios: só INSERT público; sem SELECT/UPDATE/DELETE para anon/authenticated =====
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir atualização" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir delete" ON public.usuarios;
DROP POLICY IF EXISTS "Anon pode cadastrar usuário" ON public.usuarios;
DROP POLICY IF EXISTS "Authenticated pode cadastrar usuário" ON public.usuarios;

CREATE POLICY "Anon pode cadastrar usuário"
  ON public.usuarios
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated pode cadastrar usuário"
  ON public.usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Sem políticas de SELECT/UPDATE/DELETE: perfil e alterações só pela API (service role).

-- ===== pagamentos_mercadopago =====
DROP POLICY IF EXISTS "Permitir SELECT pagamentos autenticados" ON public.pagamentos_mercadopago;
DROP POLICY IF EXISTS "Pagamentos leitura só do dono" ON public.pagamentos_mercadopago;

CREATE POLICY "Pagamentos leitura só do dono"
  ON public.pagamentos_mercadopago
  FOR SELECT
  TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

-- ===== whatsapp_logs =====
DROP POLICY IF EXISTS "Permitir SELECT para usuários autenticados" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Logs WhatsApp leitura só do dono" ON public.whatsapp_logs;

CREATE POLICY "Logs WhatsApp leitura só do dono"
  ON public.whatsapp_logs
  FOR SELECT
  TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

-- ===== subcategorias (se existir): acesso via categoria do mesmo usuário =====
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subcategorias'
  ) THEN
    ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "subcategorias_via_categoria_do_usuario" ON public.subcategorias;
    CREATE POLICY "subcategorias_via_categoria_do_usuario"
      ON public.subcategorias
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.categorias c
          WHERE c.id = subcategorias.categoria_id
            AND c.usuario_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.categorias c
          WHERE c.id = subcategorias.categoria_id
            AND c.usuario_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMENT ON POLICY "Pagamentos leitura só do dono" ON public.pagamentos_mercadopago IS
  'PostgREST com JWT: só linhas do próprio usuário. Service role da API ignora RLS.';

-- Rodar no SQL Editor do Supabase (uma vez), após migrações anteriores.
-- Garante a despesa "Tecnologia e Gadgets" e subcategorias para todo usuário que ainda não a possua.
-- Útil se o app não tiver conseguido sincronizar via API (RLS legado, dados antigos, etc.).

DO $$
DECLARE
  u RECORD;
  new_id uuid;
BEGIN
  FOR u IN SELECT id FROM public.usuarios LOOP
    IF EXISTS (
      SELECT 1
      FROM public.categorias c
      WHERE c.usuario_id = u.id
        AND lower(btrim(c.nome)) = lower(btrim('Tecnologia e Gadgets'))
        AND upper(btrim(c.tipo)) = 'DESPESA'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.categorias (usuario_id, nome, tipo, cor)
    VALUES (u.id, 'Tecnologia e Gadgets', 'DESPESA', '#334155')
    RETURNING id INTO new_id;

    INSERT INTO public.subcategorias (categoria_id, nome) VALUES
      (new_id, 'Celular Novo e Acessórios'),
      (new_id, 'Assinatura de Softwares (Office, Adobe)'),
      (new_id, 'Computadores e Periféricos'),
      (new_id, 'Jogos Digitais / Consoles'),
      (new_id, 'Hospedagem / Domínios'),
      (new_id, 'Apps Mobile');
  END LOOP;
END $$;

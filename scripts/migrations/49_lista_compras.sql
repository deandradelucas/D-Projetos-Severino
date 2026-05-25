CREATE TABLE public.shopping_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (char_length(trim(nome)) >= 1 AND char_length(nome) <= 100),
  categoria_financeira TEXT NOT NULL DEFAULT 'Alimentação',
  arquivada_em TIMESTAMPTZ DEFAULT NULL,
  criada_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_usuario ON public.shopping_lists(usuario_id);

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario_proprio_lista" ON public.shopping_lists
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE TABLE public.shopping_list_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (char_length(trim(nome)) >= 1 AND char_length(nome) <= 200),
  quantidade NUMERIC(10,2) DEFAULT 1 NOT NULL CHECK (quantidade > 0),
  unidade TEXT NOT NULL DEFAULT 'un' CHECK (char_length(unidade) <= 20),
  preco_estimado NUMERIC(12,2) DEFAULT NULL CHECK (preco_estimado IS NULL OR preco_estimado >= 0),
  categoria_item TEXT DEFAULT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  checked_em TIMESTAMPTZ DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shopping_items_lista ON public.shopping_list_items(lista_id);

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario_proprio_item" ON public.shopping_list_items
  USING (lista_id IN (SELECT id FROM public.shopping_lists WHERE usuario_id = auth.uid()))
  WITH CHECK (lista_id IN (SELECT id FROM public.shopping_lists WHERE usuario_id = auth.uid()));

COMMENT ON TABLE public.shopping_lists IS 'Listas de compras por usuário';
COMMENT ON TABLE public.shopping_list_items IS 'Itens de uma lista de compras com preço estimado e categoria';

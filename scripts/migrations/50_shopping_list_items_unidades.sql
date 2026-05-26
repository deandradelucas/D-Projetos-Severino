-- 50_shopping_list_items_unidades.sql
-- Adiciona coluna `unidades` em shopping_list_items.
--
-- Contexto: o campo `quantidade` representa a medida do produto (ex.: 5 kg, 1 L,
-- 500 g) e `unidade` é a unidade de medida ("kg", "L", "g", "un", ...).
-- Já o novo `unidades` representa quantos itens dessa medida o usuário pretende
-- comprar (ex.: 3 caixas de 5 kg). O total estimado do item é
-- `preco_estimado * unidades` (preço unitário × quantas unidades).
--
-- Histórico: itens criados antes desta migration assumem `unidades = 1` (default),
-- mantendo o comportamento prévio em que `preco_estimado` representava o total.

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS unidades INTEGER NOT NULL DEFAULT 1
    CHECK (unidades >= 1);

COMMENT ON COLUMN public.shopping_list_items.unidades IS
  'Quantas unidades do item (embalagens) o usuário pretende comprar. Total estimado = preco_estimado * unidades.';

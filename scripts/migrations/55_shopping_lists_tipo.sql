-- 55: tipo de lista (compras | tarefas)
-- "compras" = fluxo atual (preço, total, registrar gasto)
-- "tarefas" = checklist simples (sem preço/gasto)
ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'compras';

ALTER TABLE shopping_lists
  DROP CONSTRAINT IF EXISTS shopping_lists_tipo_check;

ALTER TABLE shopping_lists
  ADD CONSTRAINT shopping_lists_tipo_check CHECK (tipo IN ('compras', 'tarefas'));

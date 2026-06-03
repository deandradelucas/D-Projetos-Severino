-- #11 Lista recorrente: a lista volta a ficar "fresca" (todos os itens desmarcados)
-- a cada ciclo (semanal/mensal). Geração lazy ao abrir o app — sem cron externo.
-- Aditiva e segura: default 'nenhuma' (comportamento atual inalterado).
ALTER TABLE public.shopping_lists
  ADD COLUMN IF NOT EXISTS recorrencia text NOT NULL DEFAULT 'nenhuma'
    CHECK (recorrencia IN ('nenhuma', 'semanal', 'mensal')),
  ADD COLUMN IF NOT EXISTS proxima_geracao timestamptz NULL;

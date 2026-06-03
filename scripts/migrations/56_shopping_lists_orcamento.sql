-- Orçamento (teto) opcional por lista de compras.
-- Feature #7 — avisar quando o total estimado ultrapassar o teto.
-- Aditiva e segura: NULL = sem teto definido.
ALTER TABLE public.shopping_lists
  ADD COLUMN IF NOT EXISTS orcamento numeric(10,2) NULL
  CHECK (orcamento IS NULL OR orcamento > 0);

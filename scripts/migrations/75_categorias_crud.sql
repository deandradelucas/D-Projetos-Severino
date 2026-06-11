-- 75 — Gestão de categorias (CRUD): ícone persistido + arquivamento.
-- Aditiva e segura (ADD COLUMN IF NOT EXISTS). Sem default destrutivo.
--
-- icone:        chave do ícone escolhido pelo usuário (ex.: 'home', 'car').
--               NULL = manter resolução automática por nome (comportamento atual).
-- arquivada_em: soft delete. Categoria/subcategoria arquivada some das listas de
--               seleção mas preserva o histórico das transações que a usam.

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS icone text,
  ADD COLUMN IF NOT EXISTS arquivada_em timestamptz;

ALTER TABLE public.subcategorias
  ADD COLUMN IF NOT EXISTS arquivada_em timestamptz;

COMMENT ON COLUMN public.categorias.icone IS
  'Chave do ícone escolhido (precede a resolução por nome). NULL = automático.';
COMMENT ON COLUMN public.categorias.arquivada_em IS
  'Soft delete: arquivada some da seleção mas preserva histórico. NULL = ativa.';
COMMENT ON COLUMN public.subcategorias.arquivada_em IS
  'Soft delete da subcategoria. NULL = ativa.';

-- Listagem padrão filtra ativas por usuário.
CREATE INDEX IF NOT EXISTS idx_categorias_usuario_ativas
  ON public.categorias (usuario_id) WHERE arquivada_em IS NULL;

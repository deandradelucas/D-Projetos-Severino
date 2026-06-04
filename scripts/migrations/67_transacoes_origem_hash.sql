-- Migration 67: versiona origem_hash em transacoes (dedup de importação)
-- Aplicar MANUALMENTE em produção (Supabase Horizonte_Financeiro, ref zesyderishnbjrpfbmqa).
--
-- CONTEXTO: a coluna `origem_hash` e o índice de dedup já existem em produção
-- (criados no SQL Editor durante o Epic 7 / import de extratos), mas nunca foram
-- versionados — drift de schema (ver docs/decisions/0002-supabase-migrations-drift.md).
-- Esta migration é IDEMPOTENTE: é no-op no banco atual e restaura o schema correto
-- caso o banco seja recriado a partir das migrations.

-- Coluna que guarda o hash de origem (sha256) usado para deduplicar transações
-- importadas (Excel/PDF/OFX). Ver server/lib/import/import-service.mjs (buildHashes).
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS origem_hash text;

-- Índice composto parcial que sustenta a query de dedup
-- (fetchExistingHashes: WHERE usuario_id = ? AND origem_hash IN (...)).
CREATE INDEX IF NOT EXISTS idx_transacoes_origem_hash
  ON public.transacoes USING btree (usuario_id, origem_hash)
  WHERE (origem_hash IS NOT NULL);

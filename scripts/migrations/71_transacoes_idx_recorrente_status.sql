-- Migration 71 — Índice para a aba "Parceladas" (Auditoria squad 2026-06, A6/PERF-4).
--
-- fetchNextPendingParceladas (server/lib/transacoes.mjs) roda em toda getTransacoes
-- da visão padrão e filtra:
--   usuario_id = ? AND recorrente_grupo_id IS NOT NULL AND status = 'PENDENTE'
--   ORDER BY recorrente_grupo_id, recorrente_index
-- Sem índice cobrindo isso, o Postgres faz scan. Índice parcial (só linhas de
-- parcelamento) cobre filtro + ordenação.

CREATE INDEX IF NOT EXISTS idx_transacoes_usuario_recorrente_status
  ON public.transacoes (usuario_id, recorrente_grupo_id, status, recorrente_index)
  WHERE recorrente_grupo_id IS NOT NULL;

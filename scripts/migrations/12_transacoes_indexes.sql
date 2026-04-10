-- Índices para consultas frequentes em transacoes (GET /api/transacoes, relatórios, dashboard).
-- Cobre: WHERE usuario_id = ? [AND data_transacao entre datas] ORDER BY data_transacao DESC [RANGE offset/limit]
--
-- Execute no SQL Editor do Supabase após 11_transacoes_recorrencia_mensal_id.sql.
-- Em tabelas muito grandes em produção, prefira CREATE INDEX CONCURRENTLY (fora de transação).

-- Principal: uma linha por usuário ordenada por data (maior → menor)
CREATE INDEX IF NOT EXISTS idx_transacoes_usuario_data_transacao_desc
  ON public.transacoes (usuario_id, data_transacao DESC);

COMMENT ON INDEX public.idx_transacoes_usuario_data_transacao_desc IS
  'Listagens por usuário ordenadas por data; intervalos em data_transacao; paginação (limit/offset).';

-- Filtro por categoria + mesmo padrão de ordenação (relatório com categoria_id)
CREATE INDEX IF NOT EXISTS idx_transacoes_usuario_categoria_data_desc
  ON public.transacoes (usuario_id, categoria_id, data_transacao DESC);

COMMENT ON INDEX public.idx_transacoes_usuario_categoria_data_desc IS
  'Filtro categoria_id + ordenação por data (relatórios e transações filtradas).';

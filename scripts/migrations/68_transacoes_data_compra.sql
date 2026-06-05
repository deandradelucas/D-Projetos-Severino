-- Migration 68: data_compra em transacoes
-- Aplicar MANUALMENTE em produção (Supabase Horizonte_Financeiro, ref zesyderishnbjrpfbmqa).
--
-- Em compras parceladas, cada parcela é uma transação cuja data_transacao é o
-- VENCIMENTO da parcela (mantém o fluxo de caixa no mês correto). data_compra guarda
-- a data ORIGINAL da compra (igual para todas as parcelas do grupo), para exibição.
-- NULL para transações antigas e não-parceladas (nesses casos data_transacao já é a data real).

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS data_compra TIMESTAMPTZ;

COMMENT ON COLUMN public.transacoes.data_compra IS
  'Data original da compra (parceladas). data_transacao guarda o vencimento da parcela. NULL = usar data_transacao.';

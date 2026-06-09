-- Migration 72 — cartao_id em recorrencias_mensais.
--
-- Assinaturas recorrentes (Netflix, Spotify, etc.) associadas a um cartão
-- perdiam o vínculo: a regra mensal não guardava cartao_id, então as ocorrências
-- futuras eram geradas SEM cartao_id e não entravam na fatura do cartão.
-- Adiciona a coluna + backfill a partir da 1ª transação de cada regra.

ALTER TABLE public.recorrencias_mensais
  ADD COLUMN IF NOT EXISTS cartao_id uuid REFERENCES public.cartoes(id) ON DELETE SET NULL;

-- Backfill: pega o cartao_id da transação mais antiga vinculada à regra (se houver).
UPDATE public.recorrencias_mensais r
SET cartao_id = sub.cartao_id
FROM (
  SELECT DISTINCT ON (t.recorrencia_mensal_id)
         t.recorrencia_mensal_id, t.cartao_id
  FROM public.transacoes t
  WHERE t.recorrencia_mensal_id IS NOT NULL AND t.cartao_id IS NOT NULL
  ORDER BY t.recorrencia_mensal_id, t.data_transacao ASC
) sub
WHERE r.id = sub.recorrencia_mensal_id AND r.cartao_id IS NULL;

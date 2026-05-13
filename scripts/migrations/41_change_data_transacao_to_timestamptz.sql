-- data_transacao passa a guardar timezone para exibição correta em fusos diferentes
ALTER TABLE public.transacoes
  ALTER COLUMN data_transacao TYPE TIMESTAMPTZ USING data_transacao::TIMESTAMPTZ;

COMMENT ON COLUMN public.transacoes.data_transacao IS 'Data e hora da transação (incluindo fuso horário)';

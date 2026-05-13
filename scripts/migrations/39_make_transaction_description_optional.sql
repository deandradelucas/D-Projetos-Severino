-- descricao da transação deixa de ser obrigatória (pode ser null em recorrências/importações)
ALTER TABLE public.transacoes ALTER COLUMN descricao DROP NOT NULL;

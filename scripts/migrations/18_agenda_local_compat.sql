-- Compatibilidade local: versões antigas da Agenda usavam a coluna "local".
-- O app atual escreve em local_texto, mas manter este alias evita erro em bancos locais
-- que ainda recebam consultas legadas ou cacheadas pelo PostgREST.

ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS local_texto TEXT DEFAULT '';

ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS local TEXT DEFAULT '';

UPDATE public.agenda_eventos
SET local = COALESCE(NULLIF(local, ''), local_texto, '')
WHERE COALESCE(local, '') = ''
  AND COALESCE(local_texto, '') <> '';

UPDATE public.agenda_eventos
SET local_texto = COALESCE(NULLIF(local_texto, ''), local, '')
WHERE COALESCE(local_texto, '') = ''
  AND COALESCE(local, '') <> '';

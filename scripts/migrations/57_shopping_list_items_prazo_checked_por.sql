-- #10 Tarefa com prazo → Agenda: data do item + link pro evento criado na agenda.
-- #12 Família colaborativa: quem (qual usuário) marcou o item.
-- Aditiva e segura: tudo NULL por padrão; FKs com ON DELETE SET NULL.
ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS prazo timestamptz NULL,
  ADD COLUMN IF NOT EXISTS agenda_evento_id uuid NULL
    REFERENCES public.agenda_eventos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checked_por uuid NULL
    REFERENCES public.usuarios(id) ON DELETE SET NULL;

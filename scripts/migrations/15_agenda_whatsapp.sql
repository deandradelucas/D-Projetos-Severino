-- Agenda de compromissos + lembretes WhatsApp.
-- Compatível com o schema Supabase atual de public.agenda_eventos.

CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT '',
  descricao TEXT DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'compromisso',
  categoria TEXT DEFAULT '',
  subcategoria TEXT DEFAULT '',
  inicio_em TIMESTAMPTZ NOT NULL,
  fim_em TIMESTAMPTZ NOT NULL,
  dia_inteiro BOOLEAN NOT NULL DEFAULT false,
  local_texto TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  valor NUMERIC,
  situacao TEXT NOT NULL DEFAULT 'pendente',
  prioridade TEXT DEFAULT 'media',
  recorrencia TEXT DEFAULT 'nao-recorrente',
  lembrete TEXT DEFAULT '30-min',
  cor TEXT DEFAULT '#64748b',
  transacao_vinculada_id UUID REFERENCES public.transacoes(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_usuario_inicio
  ON public.agenda_eventos (usuario_id, inicio_em);

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_lembretes
  ON public.agenda_eventos (inicio_em, situacao)
  WHERE situacao IN ('pendente', 'confirmado') AND lembrete IS NOT NULL AND lembrete <> 'sem-lembrete';

ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agenda eventos só do dono" ON public.agenda_eventos;
CREATE POLICY "Agenda eventos só do dono"
  ON public.agenda_eventos
  FOR ALL
  TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id)
  WITH CHECK (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

COMMENT ON TABLE public.agenda_eventos IS
  'Agenda: compromissos e contas a pagar/receber por usuário.';

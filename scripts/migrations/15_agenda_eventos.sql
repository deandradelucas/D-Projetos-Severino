-- Rodar no SQL Editor do Supabase (uma vez), após migrações anteriores.
-- Eventos da agenda financeira por usuário (API Node usa service role; RLS para leituras JWT).

CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  valor NUMERIC(14, 2),
  situacao TEXT NOT NULL DEFAULT 'pendente',
  prioridade TEXT DEFAULT 'media',
  recorrencia TEXT DEFAULT 'nao-recorrente',
  lembrete TEXT DEFAULT '30-min',
  cor TEXT DEFAULT '#64748b',
  transacao_vinculada_id UUID REFERENCES public.transacoes(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT agenda_eventos_fim_apos_inicio CHECK (fim_em >= inicio_em)
);

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_usuario_inicio
  ON public.agenda_eventos(usuario_id, inicio_em DESC);

COMMENT ON TABLE public.agenda_eventos IS 'Agenda: compromissos e contas a pagar/receber por usuário.';

ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agenda leitura só do dono" ON public.agenda_eventos;

CREATE POLICY "Agenda leitura só do dono"
  ON public.agenda_eventos
  FOR SELECT
  TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

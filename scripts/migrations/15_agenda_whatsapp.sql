-- Agenda de compromissos + lembretes WhatsApp.
-- Execute no SQL Editor do Supabase após as migrations anteriores.

CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL CHECK (char_length(trim(titulo)) BETWEEN 2 AND 160),
  descricao TEXT NOT NULL DEFAULT '',
  local TEXT NOT NULL DEFAULT '',
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  lembrar_minutos_antes SMALLINT NOT NULL DEFAULT 15 CHECK (lembrar_minutos_antes BETWEEN 0 AND 1440),
  whatsapp_notificar BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'AGENDADO' CHECK (status IN ('AGENDADO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO')),
  origem TEXT NOT NULL DEFAULT 'APP' CHECK (origem IN ('APP', 'WHATSAPP', 'SISTEMA')),
  confirmado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_usuario_inicio
  ON public.agenda_eventos (usuario_id, inicio);

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_lembretes
  ON public.agenda_eventos (inicio, status)
  WHERE whatsapp_notificar = true AND status IN ('AGENDADO', 'CONFIRMADO');

CREATE TABLE IF NOT EXISTS public.agenda_lembretes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES public.agenda_eventos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  offset_minutos SMALLINT NOT NULL CHECK (offset_minutos BETWEEN 0 AND 1440),
  canal TEXT NOT NULL DEFAULT 'WHATSAPP' CHECK (canal IN ('WHATSAPP')),
  enviado_em TIMESTAMPTZ,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (evento_id, offset_minutos, canal)
);

CREATE INDEX IF NOT EXISTS idx_agenda_lembretes_pendentes
  ON public.agenda_lembretes (canal, enviado_em, usuario_id);

CREATE TABLE IF NOT EXISTS public.agenda_interacoes_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  telefone TEXT NOT NULL DEFAULT '',
  mensagem TEXT NOT NULL DEFAULT '',
  intencao TEXT NOT NULL DEFAULT '',
  resposta TEXT NOT NULL DEFAULT '',
  ok BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_agenda_interacoes_whatsapp_usuario_created
  ON public.agenda_interacoes_whatsapp (usuario_id, created_at DESC);

ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_lembretes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_interacoes_whatsapp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agenda eventos só do dono" ON public.agenda_eventos;
CREATE POLICY "Agenda eventos só do dono"
  ON public.agenda_eventos
  FOR ALL
  TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id)
  WITH CHECK (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Agenda lembretes só do dono" ON public.agenda_lembretes;
CREATE POLICY "Agenda lembretes só do dono"
  ON public.agenda_lembretes
  FOR ALL
  TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id)
  WITH CHECK (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Agenda interações leitura só do dono" ON public.agenda_interacoes_whatsapp;
CREATE POLICY "Agenda interações leitura só do dono"
  ON public.agenda_interacoes_whatsapp
  FOR SELECT
  TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

COMMENT ON TABLE public.agenda_eventos IS
  'Compromissos do usuário com status e preferências de lembrete por WhatsApp.';
COMMENT ON TABLE public.agenda_lembretes IS
  'Controle idempotente dos lembretes da agenda enviados pelo n8n/Evolution.';
COMMENT ON TABLE public.agenda_interacoes_whatsapp IS
  'Auditoria leve de comandos de agenda recebidos via WhatsApp.';

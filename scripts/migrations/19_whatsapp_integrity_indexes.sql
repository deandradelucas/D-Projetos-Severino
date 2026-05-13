-- Integridade e idempotência mínima para logs/automações WhatsApp.

ALTER TABLE public.whatsapp_logs
  ALTER COLUMN status TYPE VARCHAR(64);

ALTER TABLE public.whatsapp_logs
  ALTER COLUMN telefone_remetente TYPE VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_logs_agenda_reminder_once
  ON public.whatsapp_logs (mensagem_recebida)
  WHERE status IN ('AGENDA_LEMB_CLAIM', 'AGENDA_LEMBRETE_OK');

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_logs_inbound_message_once
  ON public.whatsapp_logs (mensagem_recebida)
  WHERE status = 'WHATSAPP_RECEBIDO';

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_usuario_data
  ON public.whatsapp_logs (usuario_id, data_hora DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status_mensagem
  ON public.whatsapp_logs (status, mensagem_recebida);

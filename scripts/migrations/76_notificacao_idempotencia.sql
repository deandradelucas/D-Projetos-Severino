-- 76: Idempotência dos crons de notificação (opção A — colunas de controle em usuarios).
-- Cada coluna marca o ÚLTIMO envio bem-sucedido daquele tipo de notificação.
-- O cron pula quem já recebeu dentro da janela do período → retry do n8n não duplica.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS notif_trial_3d_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notif_trial_1d_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notif_trial_expirado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS digest_semanal_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS digest_mensal_em        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reengajamento_em        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extrato_renovacao_em    TIMESTAMPTZ;

COMMENT ON COLUMN usuarios.notif_trial_3d_em       IS 'Último envio da notificação trial T-3d (idempotência cron).';
COMMENT ON COLUMN usuarios.notif_trial_1d_em       IS 'Último envio da notificação trial T-1d.';
COMMENT ON COLUMN usuarios.notif_trial_expirado_em IS 'Último envio da notificação de trial expirado.';
COMMENT ON COLUMN usuarios.digest_semanal_em       IS 'Último envio do digest semanal.';
COMMENT ON COLUMN usuarios.digest_mensal_em        IS 'Último envio do digest mensal.';
COMMENT ON COLUMN usuarios.reengajamento_em        IS 'Último envio da mensagem de reengajamento.';
COMMENT ON COLUMN usuarios.extrato_renovacao_em    IS 'Último envio do extrato de renovação.';

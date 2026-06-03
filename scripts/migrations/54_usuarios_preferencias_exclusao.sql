-- Migration 54: preferências (notificações + financeiras) e marcador de exclusão de conta (LGPD)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS preferencias JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS conta_exclusao_solicitada_em TIMESTAMPTZ DEFAULT NULL;

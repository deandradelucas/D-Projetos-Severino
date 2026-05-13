-- Migration 32: adiciona telefone_verificado em usuarios
-- Marcar se o número de telefone do usuário foi confirmado via OTP WhatsApp.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS telefone_verificado BOOLEAN NOT NULL DEFAULT false;

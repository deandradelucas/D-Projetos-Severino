-- Migration 53: adiciona meta e notas em investimentos_usuario
ALTER TABLE investimentos_usuario
  ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meta_carteira_valor NUMERIC(14,2) DEFAULT NULL;

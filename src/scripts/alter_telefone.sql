-- Adicionar coluna telefone na tabela usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);

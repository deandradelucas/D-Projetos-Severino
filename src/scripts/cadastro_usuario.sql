-- Execute este SQL no editor SQL do Supabase Dashboard
-- Para criar a tabela de usuários

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção
CREATE POLICY "Permitir inserção" ON usuarios
  FOR INSERT WITH CHECK (true);

-- Política para permitir leituraown
CREATE POLICY "Permitir leitura" ON usuarios
  FOR SELECT USING (true);

-- Política para permitir atualização
CREATE POLICY "Permitir atualização" ON usuarios
  FOR UPDATE USING (true);

-- Política para permitir delete
CREATE POLICY "Permitir delete" ON usuarios
  FOR DELETE USING (true);

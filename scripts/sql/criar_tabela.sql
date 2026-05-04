-- Criar tabela usuarios se não existir
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Permitir inserção" ON usuarios;
DROP POLICY IF EXISTS "Permitir leitura" ON usuarios;
DROP POLICY IF EXISTS "Permitir leitura email senha" ON usuarios;
DROP POLICY IF EXISTS "Permitir atualização" ON usuarios;
DROP POLICY IF EXISTS "Permitir delete" ON usuarios;

CREATE POLICY "Permitir inserção" ON usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura" ON usuarios FOR SELECT USING (true);
CREATE POLICY "Permitir atualização" ON usuarios FOR UPDATE USING (true);
CREATE POLICY "Permitir delete" ON usuarios FOR DELETE USING (true);

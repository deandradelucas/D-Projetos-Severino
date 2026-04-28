-- Migration: Adicionar whatsapp_id para suporte a LIDs sem perder o telefone real
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS whatsapp_id VARCHAR(50);

-- Comentário para documentar
COMMENT ON COLUMN public.usuarios.whatsapp_id IS 'ID interno do WhatsApp (LID) para vinculação quando o número real não é exposto pela API';

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_usuarios_whatsapp_id ON public.usuarios(whatsapp_id);

-- Migração de dados para usuários conhecidos (Exemplo Lucas e Renan)
-- Lucas
UPDATE public.usuarios 
SET whatsapp_id = '11987304099976', 
    telefone = '54996994482' 
WHERE email = 'lukas.andrd@gmail.com';

-- Renan
UPDATE public.usuarios 
SET whatsapp_id = '65996635246697', 
    telefone = '65996635246' 
WHERE email = 'darivarenan@gmail.com';

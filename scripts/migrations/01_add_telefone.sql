-- Script para dar permissão ao bot via WhatsApp
-- Rode no SQL Editor do seu Supabase

ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS telefone VARCHAR(20) UNIQUE;

-- Comentário da coluna para documentação
COMMENT ON COLUMN public.usuarios.telefone IS 'Telefone atrelado ao usuário para receber webhooks do WhatsApp (Formato: 55DDDNUMERO)';

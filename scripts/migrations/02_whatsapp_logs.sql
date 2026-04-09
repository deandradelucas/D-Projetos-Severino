-- Script para criar a tabela de logs do WhatsApp
-- Rode no SQL Editor do seu Supabase

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    telefone_remetente VARCHAR(20) NOT NULL,
    mensagem_recebida TEXT,
    status VARCHAR(20) NOT NULL, -- 'SUCESSO', 'IGNORADO', 'ERRO'
    detalhe_erro TEXT,
    data_hora TIMESTAMPTZ DEFAULT NOW(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL
);

-- Permissões básicas
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- SELECT só da própria linha (JWT). Inserção/atualização via service role na API.
DROP POLICY IF EXISTS "Permitir SELECT para usuários autenticados" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Logs WhatsApp leitura só do dono" ON public.whatsapp_logs;

CREATE POLICY "Logs WhatsApp leitura só do dono" ON public.whatsapp_logs
  FOR SELECT TO authenticated
  USING (usuario_id IS NOT NULL AND auth.uid() = usuario_id);

-- Comentários
COMMENT ON TABLE public.whatsapp_logs IS 'Tabela de auditoria para webhooks recebidos do WhatsApp';

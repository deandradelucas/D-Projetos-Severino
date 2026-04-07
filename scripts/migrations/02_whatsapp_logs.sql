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

-- Políticas de segurança
-- Se houver um admin específico depois podemos fechar, mas por ora daremos permissão ao servidor para inserir (Service Role faz bypass RLS default)
-- e SELECT pros usuarios logados apenas se quisermos (ou apenas fetch admin local)
CREATE POLICY "Permitir SELECT para usuários autenticados" ON public.whatsapp_logs
    FOR SELECT TO authenticated USING (true);

-- Comentários
COMMENT ON TABLE public.whatsapp_logs IS 'Tabela de auditoria para webhooks recebidos do WhatsApp';

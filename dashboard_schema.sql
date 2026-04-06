-- Arquivos para o Banco - Horizonte Financeiro
-- Script de Criação das Tabelas do Dashboard
-- Banco: Supabase / PostgreSQL

-- 1. Tabela de Categorias
CREATE TABLE public.categorias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    cor VARCHAR(7) DEFAULT '#d4a84b', -- Cor padrão em Hexadecimal
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Contas Financeiras
CREATE TABLE public.contas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    banco VARCHAR(100),
    saldo_inicial DECIMAL(12, 2) DEFAULT 0.00 NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Transações
CREATE TABLE public.transacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    valor DECIMAL(12, 2) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    data_transacao DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'EFETIVADA' CHECK (status IN ('PENDENTE', 'EFETIVADA', 'CANCELADA')),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitando RLS (Row Level Security) para segurança no Supabase
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS (Somente o próprio usuário pode ver/editar seus dados)
CREATE POLICY "Usuários veem apenas suas próprias categorias" 
    ON public.categorias FOR ALL USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários veem apenas suas próprias contas" 
    ON public.contas FOR ALL USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários veem apenas suas próprias transações" 
    ON public.transacoes FOR ALL USING (auth.uid() = usuario_id);

-- Índices de performance para relatórios
CREATE INDEX idx_transacoes_usuario_data ON public.transacoes(usuario_id, data_transacao);
CREATE INDEX idx_transacoes_tipo ON public.transacoes(tipo);

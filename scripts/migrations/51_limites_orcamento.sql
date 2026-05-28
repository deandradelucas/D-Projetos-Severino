-- Limites de orçamento por categoria (por usuário, sem vínculo de mês — aplicável sempre)
CREATE TABLE IF NOT EXISTS public.limites_orcamento (
    id          UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id  UUID            NOT NULL REFERENCES public.usuarios(id)  ON DELETE CASCADE,
    categoria_id UUID           NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
    limite_mensal DECIMAL(10,2) NOT NULL CHECK (limite_mensal > 0),
    criado_em   TIMESTAMPTZ     DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE(usuario_id, categoria_id)
);

CREATE INDEX IF NOT EXISTS idx_limites_orcamento_usuario
    ON public.limites_orcamento(usuario_id);

-- RLS: backend acessa via service role (bypassa), usuário autenticado via JWT pode ler seus próprios
ALTER TABLE public.limites_orcamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios leem seus limites"
    ON public.limites_orcamento FOR SELECT
    USING (usuario_id::text = auth.uid()::text);

CREATE POLICY "service role full access limites"
    ON public.limites_orcamento FOR ALL
    USING (true) WITH CHECK (true);

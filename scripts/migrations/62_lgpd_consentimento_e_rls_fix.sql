-- Migration 62: LGPD (consentimento + exclusão real) + correção de RLS exposta
-- Aplicar MANUALMENTE em produção (Supabase Horizonte_Financeiro, ref zesyderishnbjrpfbmqa).
-- Confirmar com o CEO antes de aplicar.

-- ── 1. Consentimento de cadastro (LGPD Art. 7/8 — base legal + transparência) ──
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS consentimento_aceito_em timestamptz,
  ADD COLUMN IF NOT EXISTS consentimento_versao text;

COMMENT ON COLUMN public.usuarios.consentimento_aceito_em
  IS 'Quando o usuário aceitou a Política de Privacidade/Termos no cadastro (LGPD).';
COMMENT ON COLUMN public.usuarios.consentimento_versao
  IS 'Versão do documento de Política/Termos aceita no cadastro (ex.: 2026-06-03).';

-- ── 2. Índice para o job de purga (exclusão real após carência de 30 dias) ────
-- conta_exclusao_solicitada_em já existe (preenchido por solicitarExclusaoConta).
CREATE INDEX IF NOT EXISTS idx_usuarios_exclusao_pendente
  ON public.usuarios (conta_exclusao_solicitada_em)
  WHERE conta_exclusao_solicitada_em IS NOT NULL;

-- ── 3. CORREÇÃO DE SEGURANÇA: habilitar RLS em 3 tabelas expostas ─────────────
-- Estavam com RLS DESABILITADO → expostas via anon key (advisor: rls_disabled).
-- Convenção do projeto: RLS habilitado SEM policy (o backend acessa via
-- service_role, que ignora RLS; a anon/public key fica bloqueada no PostgREST).
-- agenda_title_log contém transcricao + usuario_id (PII de áudio do usuário).
ALTER TABLE public.agenda_title_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_learned_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_learning_proposals ENABLE ROW LEVEL SECURITY;

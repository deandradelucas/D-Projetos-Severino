-- Migration 64: #3 corrige CHECK de fonte (groq/gemini-flash) + #4 retira aprendizado dormente
-- Aplicar MANUALMENTE em produção (Supabase Horizonte_Financeiro, ref zesyderishnbjrpfbmqa).

-- ── #3 — CHECK de fonte ───────────────────────────────────────────────────────
-- O código grava fonte='groq' e agora 'gemini-flash', mas o CHECK exigia
-- ['gemini','grok','heuristico'] → logs do Groq falhavam silenciosamente.
ALTER TABLE public.agenda_title_log DROP CONSTRAINT IF EXISTS agenda_title_log_fonte_check;
ALTER TABLE public.agenda_title_log
  ADD CONSTRAINT agenda_title_log_fonte_check
  CHECK (fonte = ANY (ARRAY['gemini'::text, 'groq'::text, 'grok'::text, 'gemini-flash'::text, 'heuristico'::text]));

-- ── #4 — retira a máquina de aprendizado dormente ─────────────────────────────
-- As "regras aprendidas" NUNCA eram aplicadas na geração (verificado); o few-shot
-- dinâmico (a partir de agenda_title_log) substitui esse pipeline.
-- agenda_title_log PERMANECE — alimenta o few-shot. Drop só de regras/propostas.
DROP TABLE IF EXISTS public.agenda_learned_rules;       -- FK -> agenda_learning_proposals
DROP TABLE IF EXISTS public.agenda_learning_proposals;

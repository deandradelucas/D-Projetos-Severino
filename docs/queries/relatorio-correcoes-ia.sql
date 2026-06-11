-- =============================================================================
-- Relatório semanal — taxa de correção da IA do bot WhatsApp
-- =============================================================================
-- Objetivo: medir ONDE a IA mais erra (títulos de agenda, categorias de
-- transação) usando os logs que o próprio sistema já grava, para calibrar
-- prompts/heurísticas com evidência (ref: docs/analise-ia-entendimento-2026-06.md).
--
-- Fontes:
--   agenda_title_log         — toda criação de evento via WhatsApp loga o título
--                              gerado + fonte (gemini|groq|gemini-flash|heuristico|cache);
--                              usuario_editou=true quando o usuário renomeou (sinal forte de erro)
--   transacao_categoria_log  — toda correção de categoria (comando "corrigir
--                              categoria" ou edição no app) — alimenta o few-shot
--   categoria_heuristica_log — quando a heurística regex sobrepôs o palpite do LLM
--
-- Como rodar: Supabase SQL Editor (projeto Horizonte_Financeiro) ou pedir ao
-- Claude ("roda o relatório de correções de IA").
-- =============================================================================

-- 1) PAINEL — semana atual vs anterior -----------------------------------------
with semana as (select now() - interval '7 days' as ini),
     anterior as (select now() - interval '14 days' as ini, now() - interval '7 days' as fim)
select 'agenda: títulos gerados (7d)' as metrica, count(*)::text as valor
  from agenda_title_log, semana where created_at >= semana.ini
union all
select 'agenda: % editados pelo usuário (7d) — SINAL DE ERRO',
       coalesce(round(100.0 * count(*) filter (where usuario_editou) / nullif(count(*),0), 1)::text || '%', '—')
  from agenda_title_log, semana where created_at >= semana.ini
union all
select 'agenda: score médio de qualidade (7d)',
       coalesce(round(avg(qualidade_score)::numeric, 2)::text, '—')
  from agenda_title_log, semana where created_at >= semana.ini
union all
select 'agenda: fonte ' || fonte || ' (7d)', count(*)::text
  from agenda_title_log, semana where created_at >= semana.ini group by fonte
union all
select 'categoria: correções do usuário (7d)', count(*)::text
  from transacao_categoria_log, semana where created_at >= semana.ini
union all
select 'categoria: correções (7d anteriores, comparação)', count(*)::text
  from transacao_categoria_log, anterior where created_at >= anterior.ini and created_at < anterior.fim
union all
select 'heurística sobrepôs LLM (7d)', count(*)::text
  from categoria_heuristica_log, semana where created_at >= semana.ini
union all
select 'transações criadas (7d, denominador geral)', count(*)::text
  from transacoes, semana where criado_em >= semana.ini
order by 1;

-- 2) AGENDA — títulos que o usuário corrigiu (o few-shot aprende com isto) -----
select created_at::date as dia, fonte,
       left(transcricao, 60) as mensagem,
       titulo_gerado, titulo_editado
from agenda_title_log
where usuario_editou and created_at >= now() - interval '30 days'
order by created_at desc
limit 30;

-- 3) AGENDA — títulos com pior score (flags de problema) ------------------------
select created_at::date as dia, fonte, qualidade_score, flags,
       left(transcricao, 60) as mensagem, titulo_gerado
from agenda_title_log
where qualidade_score < 0.75 and created_at >= now() - interval '30 days'
order by qualidade_score asc, created_at desc
limit 30;

-- 4) CATEGORIA — descrições mais corrigidas (candidatas a heurística nova) ------
select lower(descricao) as descricao, categoria_nome as corrigida_para,
       count(*) as vezes, max(created_at)::date as ultima
from transacao_categoria_log
where created_at >= now() - interval '90 days'
group by 1, 2
having count(*) >= 2
order by vezes desc, ultima desc
limit 30;

-- 5) HEURÍSTICA vs LLM — onde divergem (a heurística está certa? auditar) -------
select cat_llm as llm_sugeriu, cat_heuristica as heuristica_forcou,
       count(*) as vezes,
       array_agg(distinct left(descricao, 40)) filter (where descricao is not null) as exemplos
from categoria_heuristica_log
where created_at >= now() - interval '30 days'
group by 1, 2
order by vezes desc
limit 20;

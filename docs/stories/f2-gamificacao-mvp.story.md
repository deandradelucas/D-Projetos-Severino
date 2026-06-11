# Story F2 — Gamificação MVP (Fase 1)

**Status:** Done — deployado (commit d5cf285, 10/jun). Smoke prod (conta João): 1ª chamada desbloqueou `meta_criada`+`guardado_1k` com `novo:true`; 2ª virou `novo:false` (idempotente). Migration 74 aplicada, advisor INFO (deny-all padrão). · **Origem:** Backlog pacote 5 / [[project-gamificacao-plan]]

## Decisões do CEO (10/jun)
- **Narrador:** só na tela por agora (zero IA/WhatsApp). Ligar o WhatsApp depois sem retrabalho.
- **6 conquistas:** metas (1ª criada, 1ª concluída), guardado (R$1k, R$10k), streak de registro (7, 30 dias).
- Princípio do plano: premiar comportamento saudável, nunca gasto/atividade vazia.

## Arquitetura — derivar do estado, não espalhar triggers
Conquistas e streak são **calculados a partir dos dados existentes** (metas, aportes, criado_em das transações) num único `GET /api/gamificacao`. Sem instrumentar criar-meta/aporte/transação. Robusto e idempotente (IDS: reuse > triggers).

- **Streak usa `transacoes.criado_em` (data BRT de registro)**, não `data_transacao` — importar extrato antigo não cria streak falso. 1 "freeze": 1 dia sem registro não zera; o 2º quebra.
- **Conquista desbloqueada é permanente:** persiste em `usuario_conquistas` (uma vez gravada, fica mesmo que o valor caia depois — ex.: resgatar de uma meta não tira o selo R$1k).
- Escopo família: mesmo padrão das metas (`parseUsuarioEscopoApi` + `pessoal=1`).

## Acceptance Criteria
1. Migration 74: `usuario_conquistas (id, usuario_id FK, conquista_key, unlocked_em, UNIQUE(usuario_id,conquista_key))` + RLS enabled (deny-all, service_role) + índice por usuario_id.
2. `server/lib/gamificacao.mjs`: detecta as 6 conquistas do estado atual, persiste novos desbloqueios (idempotente), calcula streak com freeze. Lógica de datas/streak 100% pura e testável.
3. `GET /api/gamificacao` retorna `{ conquistas: [{key,nome,descricao,icone,desbloqueada,unlocked_em,novo}], streak: {atual} }`. `novo:true` só nas conquistas desbloqueadas NESTA chamada (primeira vez) → front celebra uma vez.
4. Front: bloco de conquistas + streak na página Metas (selos coloridos/cinza); celebração (modal/toast) quando vier `novo`.
5. Conquistas: `meta_criada` (≥1 meta), `meta_concluida` (≥1 com concluida_em), `guardado_1k`/`guardado_10k` (SUM valor_guardado das metas não-arquivadas), `streak_7`/`streak_30` (streak ≥ 7/30).
6. Testes: streak (consecutivo, freeze de 1 dia, quebra no 2º gap, hoje vs ontem como âncora), prevDay BRT, detecção de conquistas (mock). lint+test:unit+build verdes.

## Out of scope (Fases 2/3)
Score de saúde financeira, desafios mensais, XP/níveis, liga familiar, narrador WhatsApp, conquistas de disciplina (fatura/orçamento).

## File List
- `scripts/migrations/74_usuario_conquistas.sql` · `server/lib/gamificacao.mjs` · `server/routes/register-gamificacao.mjs` (+ registrar em register-all) · `server/tests/gamificacao.test.mjs`
- front: `src/components/ConquistaIcon.jsx` · `src/components/GamificacaoBloco.jsx` · integração em `src/pages/Metas.jsx` · CSS em `src/styles/pages/metas.css`

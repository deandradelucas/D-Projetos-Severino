# Backlog de Melhorias — Severino (10/jun/2026)

Consolidação das 5 auditorias de junho (full-stack 06/jun, UI/UX, arquitetura, squad 07/jun, incremental 10/jun) com **status re-verificado no código de hoje**. O que já foi corrigido saiu da lista. Ordenado por ROI (impacto ÷ esforço).

> Contexto: a auditoria de arquitetura foi **encerrada formalmente** ("o caminho de maior retorno daqui em diante é evolução de produto/feature — não mais refatoração"). Este backlog reflete isso: produto primeiro, débito técnico só o que ainda paga.

---

## 1️⃣ Segurança — pendências reais (verificadas hoje)

| # | Item | Evidência | Esforço | Impacto |
|---|------|-----------|---------|---------|
| S1 | **Refresh token em `localStorage`** → migrar p/ cookie `HttpOnly; Secure; SameSite=Strict` | `horizonteAccessToken.js:23` (confirmado hoje) | Médio-alto (mexe no fluxo login/refresh, testar bem) | Alto — XSS hoje rouba sessão de 30d |
| S2 | ✅ **FEITO (10/jun, commit 8251ffa)** CORS de mestredamente.com agora é https-only (Traefik já redireciona http globalmente; exceções via `CORS_ORIGINS`) | `app.mjs` | — | — |
| S3 | ✅ **FEITO (10/jun, na VPS)** redis-server instalado + `REDIS_URL` no .env + restart; validado em produção (chaves `rl:login-email:*` criadas após logins de teste). `PASSWORD_OTP_PEPPER` também já setado (pré-requisito do deploy resolvido). | VPS | — | — |
| S4 | ✅ **FEITO (10/jun, commit 8251ffa)** resolvido no código (sem mexer no Traefik/Easypanel): `clientKeyFromHono` usa o ÚLTIMO IP do XFF (acrescentado pelo nosso proxy) em vez do primeiro (forjável) + 4 testes | `rate-limit.mjs` | — | — |
| S5 | ✅ **FEITO (10/jun)** Senha mínima 8 chars onde se CRIA senha (cadastro, troca, recuperação WhatsApp, front) — login continua aceitando 6 p/ contas antigas | `register-auth.mjs`, `register-usuario-perfil.mjs`, `password-otp-whatsapp.mjs`, `Cadastro/Login/Configuracoes.jsx` | — | — |
| S6 | Token do webhook WhatsApp no path da URL (vaza em logs) | SEC-10 squad | Baixo | Baixo |
| S7 | ✅ **CONCLUÍDO (10/jun)** — Asaas rotacionada com whitelist de IP (só VPS; local dá 403 not_allowed_ip por design; incidente de cópias truncadas corrigido via SFTP, validado HTTP 200 da VPS). n8n rotacionada (nova 200, antiga revogada 401, sincronizada nos .env locais, removida de notas em texto plano). | — | — | — |

## 2️⃣ Performance — ganhos rápidos

| # | Item | Evidência | Esforço | Impacto |
|---|------|-----------|---------|---------|
| P1 | ✅ **FEITO (10/jun)** Removida a regra `id.includes('jspdf')` do manualChunks — ela arrastava um módulo compartilhado pro chunk e o entry passava a importá-lo estaticamente. Verificado no dist: zero modulepreload de jspdf, entry limpo, jspdf virou chunk assíncrono (~130KB gzip) carregado só ao exportar PDF. **−139KB gzip do caminho crítico de 100% dos usuários.** | `vite.config.js` | — | — |
| P2 | ✅ **FEITO (10/jun)** `pwa-app-icon.png` 558KB→17KB (1254px→512px) + `Severino Tema Claro.png` 272KB→94KB (sharp, palette q90) — conferir visual do logo no login | `public/` | — | — |
| P3 | ✅ **JÁ ESTAVA RESOLVIDO** (verificado 10/jun): o polling só roda com `visibilityState === 'visible'` e pula /pagamento, /investimentos e rotas de auth (`TransactionCacheContext.jsx:99-130`). Mantido como está — ampliar o skip arriscaria dados velhos no Dashboard. | — | — | — |
| P4 | `line-awesome.min.css` 89KB no main — **A8 do squad foi marcado inválido** (fallback de ícones de categoria usa `las la-*`), mas dá pra subsetar a fonte só com os glifos usados | `TransacaoCategoriaIcon` | Médio | Baixo-médio |
| P5 | ❌ **NÃO-APLICÁVEL** (verificado 10/jun): o front não fala com Supabase — só com a API, mesma origem em prod. Preconnect não ajuda. | PERF-10 squad partia de premissa errada | — | — |

## 3️⃣ UI/UX & Acessibilidade (da auditoria ui-ux-pro-max, ordem de ROI já definida lá)

| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| U1 | ✅ **FEITO (10/jun)** Touch targets ≥44px via hit-area (pseudo-elemento/padding+margin): Transações (editar/excluir, parcelas, limpar busca), Cartões (kebab, swatch, nav fatura), Metas (kebab, swatch, ícones) | — | — |
| U2 | ✅ **JÁ ESTAVA MIGRADO** (verificado 10/jun): emojis do chrome já eram SVG (IconUsers/IconMoreVertical/chevrons/TrendArrow; até o seletor de ícones das Metas virou MetaIcon). Só faltavam width/height nos ícones de empty-state (IconCard/IconTarget) — adicionados (anti-sumiço iOS) | — | — |
| U3 | ✅ **FEITO (10/jun)** `useModalA11y` aplicado em 10 modais: Metas (2), Pagamento (cancelar + PixQr), Configurações (excluir conta), TransacaoDetalhe, Agenda, Investimentos (Novo c/ blockClose p/ preservar Escape do dropdown, Aporte, AportesDetalhe, Comparador). Listeners de Escape duplicados removidos. HorizonChat (trap próprio), ModoComprando e DatePicker ficam como estão. | — | — |
| U4 | ✅ **JÁ ESTAVA RESOLVIDO** (verificado 10/jun): `TransacaoRow` tem `role="button"`, `tabIndex` e `onKeyDown` | — | — |
| U5 | ✅ **FEITO (10/jun)** `:focus-visible` com ring accent em ~35 componentes de Cartões/Metas/Transações/Relatórios. O "ring global preso em @media 769px" não existe mais (partial 13 foi refatorado) | — | — |
| U6 | ✅ **FEITO (10/jun)** — `alertdialog` no ConfirmDialog, `aria-label` em Encerrar recorrência e Remover convite, `role=progressbar` nas barras de Metas/Relatórios. Sidebar (`aria-current`+Sair), MobileBottomNav e InvestimentoCard já estavam ok. | — | — |
| U7 | Skeletons em Cartões/Metas (content-jumping no load) | Baixo | Baixo |
| U8 | ✅ **FEITO (10/jun)** `isIosNonSafari()` (CriOS/FxiOS/EdgiOS/Opera) → instrução genérica do menu Compartilhar + sugestão de abrir no Safari | — | — |
| U9 | Contrastes <4.5:1 (tokens `--neu-text-lo`, `--m-accent-fg`) — ajuste fino de token | Baixo | Baixo |

## 4️⃣ Bugs baixos conhecidos (auditoria 10/jun)

| # | Item | Arquivo |
|---|------|---------|
| B1 | ✅ **FEITO (10/jun)** `excluirConta` com `finally` | `Configuracoes.jsx` |
| B2 | ✅ **FEITO (10/jun)** `salvarNome`: update do localStorage agora é não-fatal (try/catch próprio) | `Configuracoes.jsx` |
| B3 | ✅ **FEITO (10/jun)** `duplicarLista` conta falhas por item e avisa no toast | `ListaDeCompras.jsx` |
| B4 | ✅ **FEITO (10/jun)** `IconClipboard` com width/height 40 + CSS explícito no empty-state | `ListaIcons.jsx` + `listas.css` |
| B5 | Dashboard × Transações: totais divergentes (PENDENTE incluído/excluído) — FE-5 squad | `Dashboard` vs `calcularQuickTotals` |
| B6 | `exhaustive-deps` suprimido lendo CPF defasado no Pix — FE-4 squad | `Pagamento.jsx:364` |

## 5️⃣ Testes & robustez

| # | Item | Por quê |
|---|------|---------|
| T1 | ✅ **FEITO (10/jun)** +14 testes: `parcelas-pendentes.test.mjs` (5 — corte fim-do-dia BRT, filtros, contagem, propagação de erro) e `import-service.test.mjs` (9 — dedup intra-lote com counter, dedup vs banco, FITID, fallback Outros, meio-dia UTC, erros parciais, resumo/período) | — |
| T2 | Teste dos novos rate limits + revogação de sessão pós-senha | Acabaram de entrar (commit 02f0390) |
| T3 | `exportarDadosUsuario` (LGPD) e `agenda_eventos` sem limit/paginação | BACKEND-6/12 squad — crescem sem teto |
| T4 | Fuzzy lookup em `payer_email` (viola rule data-lookup-safety) | `pagamentos-asaas.mjs:272` |

## 6️⃣ Produto (maior retorno segundo a re-auditoria de arquitetura)

| # | Item | Status/Nota |
|---|------|-------------|
| F1 | **Gargalo da IA do WhatsApp** — Gemini free limita ~37 usuários ativos/dia; multi-provider (Grok já integrado) + cache de parsing | **Maior alavanca de escala** (roadmap jun/2026) |
| F2 | **Gamificação Fase 1 (MVP)** — conquistas + streak + celebração; Severino IA como narrador | Plano faseado já desenhado ([[project-gamificacao-plan]]) |
| F3 | **Push notifications PWA** — engajamento/retenção (lembretes sem depender do WhatsApp) | Roadmap pendente |
| F4 | Multi-carteira/contas (saldo por conta) | Roadmap pendente |
| F5 | Login social (Google) — reduz fricção do cadastro | Roadmap pendente |
| F6 | Foto do comprovante → transação (OCR) | Roadmap pendente |
| F7 | Insights da IA alimentando o digest semanal do WhatsApp (motor `insights.mjs` já existe, é só plugar) | Ganho barato |
| F8 | Densidade desktop da página Pagamento (pendência #8 da repaginada) | UI |

## ❌ Não fazer (avaliado e descartado com dados)
- **Migração `@layer` do CSS** — POC quebrou 155/155 elementos; ~5.900 `!important` restantes são estruturais (skin-sobre-base). Aceito como débito de manutenibilidade.
- **Unificar os 2 sistemas de tokens** — são complementares e 95% disjuntos (falso problema).
- **Remover line-awesome inteiro** — é fallback vivo de ícones de categoria.
- **Open Finance via Pluggy** — R$2.500/mês inviável agora; reavaliar Belvo quando escalar.
- **marketing-stats (A4 squad)** — arquivo não existe mais (seção Admin removida); resolvido por remoção.

---

## Sugestão de pacotes de execução

1. ✅ **Pacote "1 tarde" (quick wins) — CONCLUÍDO em 10/jun:** S5, P2, B1-B4, U6 feitos; U4 já estava resolvido; P5 não-aplicável.
2. 🟡 **Pacote "infra de produção" — parte de código FEITA (10/jun):** S2 e S4 corrigidos no código (commit 8251ffa). **Resta na VPS:** S3 (Redis + REDIS_URL), PASSWORD_OTP_PEPPER no .env (pré-requisito do commit 02f0390!), e S7 rotação de chaves Asaas/N8N (manual, painéis). Roteiro:
   ```bash
   # na VPS (root):
   apt-get update && apt-get install -y redis-server && systemctl enable --now redis-server
   cd /home/lucas/severino
   tail -c1 .env | read -r _ || echo >> .env   # garante newline no fim
   echo "REDIS_URL=redis://127.0.0.1:6379" >> .env
   echo "PASSWORD_OTP_PEPPER=$(openssl rand -hex 32)" >> .env
   pm2 restart severino
   curl -s http://localhost:3001/api/health
   ```
3. ✅ **Pacote "mobile polish" — CONCLUÍDO em 10/jun:** U1, U5, U8 feitos; U2 e P3 já estavam resolvidos (verificado).
4. ✅ **Pacote "a11y modais" — CONCLUÍDO em 10/jun:** rollout do `useModalA11y` em 10 modais (wrapper `<Modal>` descartado — o hook já é o padrão do projeto, IDS: reuse > create).
5. **Epic produto:** F1 (escala da IA) → F2 (gamificação MVP) → F3 (push PWA) — nessa ordem; F7 de carona no F1.
6. **Quando sobrar fôlego:** S1 (cookie httpOnly — o item de segurança mais valioso, mas o mais delicado), P1 (manualChunks), T1-T4.

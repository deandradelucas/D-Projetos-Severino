# Severino — guia para agentes (IA e humanos)

## Framework mandante — Segunda-feira (DOMINA-IA)

A orquestração de agentes, skills, regras de governança, SDC (Story Development Cycle), Consciousness Engine e convenções de qualidade (EROS, IDS, handoff, etc.) seguem o framework **[Segunda-feira](https://github.com/DOMINA-IA/segunda-feira)** neste repositório.

| O quê | Onde |
|--------|------|
| Constituição e sistema de agentes | `segunda-feira/CLAUDE.md` |
| Regras (16) | `segunda-feira/rules/` |
| Agentes especialistas | `segunda-feira/agents/` |
| Skills | `segunda-feira/skills/` |
| Consciousness Engine | `segunda-feira/consciousness/` |
| Comandos / orquestradores | `segunda-feira/commands/` |
| Automação (n8n, Make, webhooks, Evolution API, cron, pipelines) | `segunda-feira/agents/automation-architect.md` (**Wire**) |

Em tarefas de IA, trate o Segunda-feira como **mandante de processo**: persona por `@agente`, skills com `/nome`, leitura das regras quando o assunto for workflow, autoridade, MCP ou consciência. O bloco **Stack** abaixo continua sendo a fonte deste app (React, Hono, Supabase, pastas do Severino).

CLI (opcional, ambiente local): `npm install -g ./segunda-feira` a partir da raiz do repo; comando `segunda-feira` instala/atualiza artefatos no diretório do Claude Code (`~/.claude` no perfil do utilizador), útil se usares Claude Code em paralelo.

---

## Stack

- **Frontend:** React 19, Vite 8, Tailwind 4 (`src/index.css` + `@theme`), React Router 7. Estilos de app autenticada em `src/pages/dashboard.css` (importado pelas páginas do shell).
- **API:** Hono em `server/app.mjs`. **Dev local:** `node server/index.mjs`. **Produção (Vercel):** `api/index.js` adapta `req`/`res` do Node para `Request` e chama `app.fetch`.
- **Dados:** Supabase Postgres. Cliente admin no servidor: `server/lib/supabase-admin.mjs`. Cliente público (cadastro): `src/lib/supabase.js`.
- **Migrations SQL:** `scripts/migrations/` — rodar no SQL Editor do Supabase na ordem numérica quando indicado. SQL manual/legado fica em `scripts/sql/`.

### Supabase e MCP (agente)

- Regra Cursor **`.cursor/rules/supabase-mcp-agent.mdc`**: quando trabalhar em banco, usar o **MCP Supabase** (configuração no cliente Cursor, endpoint read-only) para alinhar schema/dados com o código — em conjunto com `scripts/migrations/`.
- Servidor Node aceita **`VITE_SUPABASE_URL` ou `SUPABASE_URL`** + **`SUPABASE_SERVICE_ROLE_KEY`** (`server/lib/supabase-admin.mjs`).

### Cursor — skills por objetivo

Skills em `.agents/skills/` quando existirem no clone; regras em `.cursor/rules/` para este app.

| Objetivo | O que usar |
|----------|------------|
| Rever arquitetura / fluxo / código legado | **code-archaeologist** ou **explorer-agent**. |
| Implementar ou corrigir | **dev** ou **frontend-specialist** / **backend-specialist**. |
| Bug / erro / causa raiz | **debugger**. |
| Testes e cobertura | **test-engineer**; E2E → **qa-automation-engineer**. |
| Segurança | **security-auditor**. |
| Várias áreas ao mesmo tempo | **orchestrator**. |
| UX (acessibilidade, fluxo, consistência sem quebrar o shell) | **frontend-specialist** + **`.cursor/rules/horizonte-ux.mdc`**. |

## Comandos

| Comando | Uso |
|--------|-----|
| `npm run dev` | Front (Vite) + API local em paralelo |
| `npm run build` | Build de produção do front |
| `npm run lint` | ESLint (browser: `src/`; Node: `api/`, `server/`, `scripts/`) |
| `npm run test` | `build` + `lint` (smoke de integridade) |
| `npm run audit:dashboard-css` | Lista classes em `dashboard.css` sem uso aparente em `src/` (há safelist para Recharts e previews de tema) |
| `npm run n8n:push` | Atualiza o workflow WhatsApp no n8n via API (`scripts/push-n8n-whatsapp-bot-workflow.mjs` — mescla `.env` → `.env.local` → `.env.production` → `.env.production.local`) |

## Rotas da API (Hono)

Prefixo `/api`. Autenticação: login grava `horizonte_user` no `localStorage` (front); chamadas autenticadas enviam o que o backend espera (ver rotas em `server/app.mjs`).

## Convenções

- Preferir **alterações mínimas** e alinhadas ao estilo existente (nomes em português na UI, comentários curtos onde ajudam).
- **Segredo:** nunca commitar `.env`; variáveis em Vercel / ambiente local.
- **Usuários:** tabela `usuarios`; coluna de nome pode ser `nome` ou legado `usuario` — ver `server/lib/usuario-schema.mjs`.
- **Organização:** seguir `docs/code-organization.md` para aliases (`@`, `@components`), fronteiras entre `pages`/`components`/`lib` e extração gradual de rotas Hono.

### Shell hub (cabeçalho em vidro — **não mexer sem necessidade**)

Comportamento final validado (mobile Safari + tema claro/escuro). Evitar refactors “de passagem” em `dashboard.css` / estrutura JSX deste fluxo.

- **Markup:** em páginas com `.dashboard-hub`, o `<section class="dashboard-hub__hero">` deve ser o **primeiro filho** de `<RefDashboardScroll>` (rolagem única em `.ref-dashboard-scroll`).
- **CSS:** bloco marcado `SHELL HUB — CONTRATO ESTÁVEL` em `src/pages/dashboard.css` — sticky no hero, `main.ref-dashboard-main--scrolled` com **`backdrop-filter: blur(1px)`** ao rolar (alinhado ao `blur(1px)` de `index.css` em `.app-routes-grow`).
- **JS:** `ShellStickyHeaderScroll.jsx` escuta `.ref-dashboard-scroll` e aplica `ref-dashboard-main--scrolled` no `<main>`.

Se precisar mudar blur, stacking ou ordem do DOM, testar Dashboard e uma página hub no telemóvel antes de commitar.

## Mapa rápido de pastas

- `src/pages/` — telas (Dashboard, Transacoes, Login, admin, etc.)
- `src/components/` — Sidebar, modais, chat, PWA
- `server/lib/` — lógica de domínio (transações, usuários, pagamentos Asaas, WhatsApp, AI)
- `api/` — apenas entrada Vercel

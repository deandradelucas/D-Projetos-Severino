# Horizonte Financeiro — guia para agentes (IA e humanos)

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

Em tarefas de IA, trate o Segunda-feira como **mandante de processo**: persona por `@agente`, skills com `/nome`, leitura das regras quando o assunto for workflow, autoridade, MCP ou consciência. O bloco **Stack** abaixo continua sendo a fonte deste app (React, Hono, Supabase, pastas do Horizonte).

CLI (opcional, ambiente local): `npm install -g ./segunda-feira` a partir da raiz do repo; comando `segunda-feira` instala/atualiza artefatos no diretório do Claude Code (`~/.claude` no perfil do utilizador), útil se usares Claude Code em paralelo.

---

## Stack

- **Frontend:** React 19, Vite 8, Tailwind 4 (`src/index.css` + `@theme`), React Router 7. Estilos de app autenticada em `src/pages/dashboard.css` (importado pelas páginas do shell).
- **API:** Hono em `server/app.mjs`. **Dev local:** `node server/index.mjs`. **Produção (Vercel):** `api/index.js` adapta `req`/`res` do Node para `Request` e chama `app.fetch`.
- **Dados:** Supabase Postgres. Cliente admin no servidor: `server/lib/supabase-admin.mjs`. Cliente público (cadastro): `src/lib/supabase.js`.
- **Migrations SQL:** `scripts/migrations/` — rodar no SQL Editor do Supabase na ordem numérica quando indicado.

## Comandos

| Comando | Uso |
|--------|-----|
| `npm run dev` | Front (Vite) + API local em paralelo |
| `npm run build` | Build de produção do front |
| `npm run lint` | ESLint (browser: `src/`; Node: `api/`, `server/`, `scripts/`) |
| `npm run test` | `build` + `lint` (smoke de integridade) |
| `npm run audit:dashboard-css` | Lista classes em `dashboard.css` sem uso aparente em `src/` (há safelist para Recharts e previews de tema) |

## Rotas da API (Hono)

Prefixo `/api`. Autenticação: login grava `horizonte_user` no `localStorage` (front); chamadas autenticadas enviam o que o backend espera (ver rotas em `server/app.mjs`).

## Convenções

- Preferir **alterações mínimas** e alinhadas ao estilo existente (nomes em português na UI, comentários curtos onde ajudam).
- **Segredo:** nunca commitar `.env`; variáveis em Vercel / ambiente local.
- **Usuários:** tabela `usuarios`; coluna de nome pode ser `nome` ou legado `usuario` — ver `server/lib/usuario-schema.mjs`.

### Shell hub (cabeçalho em vidro — **não mexer sem necessidade**)

Comportamento final validado (mobile Safari + tema claro/escuro). Evitar refactors “de passagem” em `dashboard.css` / estrutura JSX deste fluxo.

- **Markup:** em páginas com `.dashboard-hub`, o `<section class="dashboard-hub__hero">` deve ser o **primeiro filho** de `<RefDashboardScroll>` (rolagem única em `.ref-dashboard-scroll`).
- **CSS:** bloco marcado `SHELL HUB — CONTRATO ESTÁVEL` em `src/pages/dashboard.css` — sticky no hero, `main.ref-dashboard-main--scrolled` com **`backdrop-filter: blur(1px)`** ao rolar (alinhado ao `blur(1px)` de `index.css` em `.app-routes-grow`).
- **JS:** `ShellStickyHeaderScroll.jsx` escuta `.ref-dashboard-scroll` e aplica `ref-dashboard-main--scrolled` no `<main>`.

Se precisar mudar blur, stacking ou ordem do DOM, testar Dashboard e uma página hub no telemóvel antes de commitar.

## Mapa rápido de pastas

- `src/pages/` — telas (Dashboard, Transacoes, Login, admin, etc.)
- `src/components/` — Sidebar, modais, chat, PWA
- `server/lib/` — lógica de domínio (transações, usuários, MP, WhatsApp, AI)
- `api/` — apenas entrada Vercel

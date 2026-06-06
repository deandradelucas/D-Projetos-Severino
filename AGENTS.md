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
- **API:** Hono em `server/app.mjs`. **Dev local:** `node server/index.mjs`. **Deploy atual:** Hostinger VPS (`deploy/hostinger-vps/`, com PM2 + nginx); `vercel.json` mantém `"ignoreCommand": "exit 0"` para evitar builds automáticos enquanto o stack vive em VPS.
- **Dados:** Supabase Postgres. Cliente admin no servidor: `server/lib/supabase-admin.mjs`. Cliente público (cadastro): `src/lib/supabase.js`.
- **Migrations SQL:** `scripts/migrations/` — rodar no SQL Editor do Supabase na ordem numérica quando indicado.

### Supabase — banco, migrations e erros comuns

- **Antes** de alterar queries em `server/lib/*.mjs`, confirmar que colunas/tabelas existem: usar o **MCP Supabase** (read-only, quando disponível no cliente) **ou** os ficheiros em `scripts/migrations/` (ordem numérica).
- Servidor Node aceita **`VITE_SUPABASE_URL` ou `SUPABASE_URL`** + **`SUPABASE_SERVICE_ROLE_KEY`** (`server/lib/supabase-admin.mjs`).
- **Nunca** colocar `SUPABASE_SERVICE_ROLE_KEY` ou segredos em regras, skills ou commits.

**Onde está a verdade no código:**

| O quê | Onde |
|--------|------|
| Cliente admin (service role) | `server/lib/supabase-admin.mjs` — URL: `VITE_SUPABASE_URL` **ou** `SUPABASE_URL` |
| Listagem / filtros admin de usuários | `server/lib/usuarios.mjs` (`listUsuariosAdminPaged`, `applyUsuariosAdminFilters`) |
| Mapeamento de erros úteis na API | `server/app.mjs` — `mapSupabaseOrNetworkError` |

**Erros comuns (cicatrizes de incidente):**

- **URL só no front:** no Vercel/Serverless, definir também `VITE_SUPABASE_URL` ou `SUPABASE_URL` para as funções que usam `getSupabaseAdmin()`.
- **Coluna/tabela em falta:** mensagens amigáveis após `mapSupabaseOrNetworkError`; aplicar SQL em `scripts/migrations/`.
- **Busca admin com vírgula:** o filtro `.or()` do PostgREST separa condições por vírgula; a busca por texto sanitiza vírgulas (`sanitizeOrSearchText` em `usuarios.mjs`). Busca por **UUID** usa `id` direto.
- **Timestamps dentro de `.or()`:** valores ISO têm `:` e precisam ir entre aspas (`postgrestOrFilterQuotedValue` em `usuarios.mjs`); sem isso o PostgREST responde **PGRST100** e a lista admin falha.

### UX — acessibilidade e consistência com o shell

Ao mexer em experiência de uso, acessibilidade, navegação ou feedback de carregamento/erro:

1. **Respeitar o contrato do shell** (ver *Shell hub* abaixo): não alterar à-toa `dashboard.css` / hero / blur sem testar mobile e tema claro/escuro.
2. **Teclado e leitores:** `focus-visible` em controlos interativos; não substituir `:focus-visible` por `:focus` onde o projeto já separa (sidebar shell).
3. **Mobile:** áreas tocáveis ≥ 44px onde fizer sentido; menu lateral com backdrop semântico (`button`), fechar com **Escape** e por toque no fundo.
4. **Movimento:** respeitar `prefers-reduced-motion` em animações novas.
5. **Carregamento:** lazy routes com fallback `role="status"` + texto `.sr-only` + barra visível.

| Tema | Ficheiros de referência |
|------|-------------------------|
| Skip link + `#app-main` | `src/App.jsx`, `.skip-to-main` em `src/index.css` |
| Texto só leitor / fallback rota | `.sr-only`, `src/components/RoutePageFallback.jsx` |
| Menu mobile | `src/components/Sidebar.jsx`, `.mobile-backdrop` em `src/pages/dashboard.css` |
| Foco no login | `src/pages/Login.jsx` (`focus-visible:ring-*`) |

### Agentes por objetivo (Segunda-feira)

Personas em `segunda-feira/agents/` — ativar com `@nome`:

| Objetivo | Agente |
|----------|--------|
| Rever arquitetura / fluxo / código legado | **@architect** |
| Implementar ou corrigir | **@dev** |
| Testes e cobertura | **@qa** (gate) / **@tester** (geração) |
| Segurança | **@security-auditor** |
| Banco de dados / migrations / RLS | **@data-engineer** |
| Deploy / git push / CI | **@devops** (autoridade exclusiva) |
| Orquestração multi-área | **@sf-master** |

## Comandos

| Comando | Uso |
|--------|-----|
| `npm run dev` | Front (Vite) + API local em paralelo |
| `npm run build` | Build de produção do front |
| `npm run lint` | ESLint (browser: `src/`; Node: `api/`, `server/`, `scripts/`) |
| `npm run test` | `build` + `lint` (smoke de integridade) |
| `npm run audit:dashboard-css` | Lista classes em `dashboard.css` sem uso aparente em `src/` (há safelist para Recharts e previews de tema) |
| `npm run n8n:push` | Atualiza o workflow WhatsApp no n8n via API (`scripts/push-n8n-whatsapp-bot-workflow.mjs` — mescla `.env` → `.env.local` → `.env.production` → `.env.production.local`) |

## Definition of Done (Severino)

Aplicação do processo Segunda-feira a este projeto. O peso é **proporcional ao risco** — não burocratizar tarefa trivial.

### Quando exige story (`docs/stories/`) vs quando é direto

| Tarefa | Processo |
|--------|----------|
| Fix de CSS, ajuste mobile, typo, rename, copy | **Direto.** Sem story. |
| Feature nova, refactor, mudança em **pagamento / IA / auth / deploy / Supabase** | **Story** (`{epic}.{n}-nome.story.md`) → implementar → QA → push |
| Bug com causa-raiz não óbvia | Consultar memória/heurística **antes**, depois corrigir |

### Antes de marcar uma task como concluída

> A Constituição manda `lint && typecheck`. **Este projeto é JS puro** (`jsconfig.json`, sem `tsconfig`) — **não existe `typecheck`**. O equivalente real é:

```bash
npm run lint && npm run test:unit && npm run build
```

Atalho equivalente: `npm run ci` (roda `test:unit + lint + build + audit:dashboard-css`).

### Gate de deploy — só o @devops (autoridade exclusiva)

`git push` e deploy na VPS são do **@devops**. Checklist obrigatório (cicatrizes de incidente):

1. **`git push` ANTES de deployar** — `git pull` na VPS não pega commits locais não-publicados.
2. **Env vars explícitas** — `--env-file` não funciona nos scripts da VPS; usar `grep .env` + prefixo no comando.
3. **Commits atômicos** — não misturar limpeza/docs com feature; submódulo `segunda-feira/` fica fora dos commits do app.

### Regras Segunda-feira que mais pesam aqui

- **External API: SYNC > CACHE > REAL-TIME** — dashboard/relatório/listagem **nunca** chama Gemini/Asaas/Supabase direto no request. Sincronizar para o DB primeiro. (Foi a causa do rate limit do Gemini.)
- **Story scope é lei** — implementar o AC, não inventar feature. Cuidado com "melhorar de passagem" (ver *Shell hub* abaixo — contrato estável).
- **Consultar antes de criar** — as memórias do projeto (`~/.claude/.../memory/`) são o cérebro: deploy, regex não-ASCII, Supabase date-range, etc. já estão documentados.
- **EROS veredito** em entrega relevante (feature/refactor): completude · precisão · sem regressão, antes de dizer "pronto".

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

### FAB padrão (botão primário de criar — **uma regra para todos**)

Todo botão primário de **criar** de página hub usa o **mesmo FAB mobile**, com o mesmo layout e o mesmo efeito de minimizar ao rolar. Referência: «+ Nova transação». Páginas: Nova transação, Novo investimento, Nova agenda, Nova lista, Novo cartão, Nova meta.

- **Markup (idêntico em todas):**
  ```jsx
  <button
    type="button"
    className={`dashboard-mobile-tx-fab${fabCompact ? ' dashboard-mobile-tx-fab--compact' : ''}`}
    onClick={abrirModal}
    aria-label="Criar …"
  >
    <span className="dashboard-mobile-tx-fab__icon" aria-hidden>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
    </span>
    <span className="dashboard-mobile-tx-fab__label">Novo …</span>
  </button>
  ```
- **Encolher ao rolar:** hook `src/hooks/useFabCompact.js` — `const fabScrollRef = useRef(null); const fabCompact = useFabCompact(fabScrollRef)` e passar `ref={fabScrollRef}` no `<RefDashboardScroll>`. NÃO reimplementar o listener de scroll por página.
- **CSS:** base + `--compact` são page-agnostic (`02b`, `22`); gold dark por página (`07`/`07b`/`05` ou o page-agnostic `36-fab-standard.css` para Listas/Cartões/Metas). Esconder o botão de header no mobile quando o FAB o substitui.
- **Esconder o FAB** quando há modal/overlay aberto ou quando colidiria com um footer fixo (ex.: Listas só mostra o FAB «Nova lista» na visão geral, sem lista ativa).
- **Mobile-only:** o FAB só aparece em `≤768px`; no desktop continua o botão de header/hero.

Ao criar uma página hub nova com ação de criar, use este FAB + `useFabCompact` — não invente um botão novo.

## Mapa rápido de pastas

- `src/pages/` — telas (Dashboard, Transacoes, Login, admin, etc.)
- `src/components/` — Sidebar, modais, chat, PWA
- `server/lib/` — lógica de domínio (transações, usuários, pagamentos Asaas, WhatsApp, AI)
- `api/` — apenas entrada Vercel

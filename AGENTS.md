# Horizonte Financeiro — guia para agentes (IA e humanos)

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

## Mapa rápido de pastas

- `src/pages/` — telas (Dashboard, Transacoes, Login, admin, etc.)
- `src/components/` — Sidebar, modais, chat, PWA
- `server/lib/` — lógica de domínio (transações, usuários, MP, WhatsApp, AI)
- `api/` — apenas entrada Vercel

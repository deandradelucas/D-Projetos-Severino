# Tech Stack — Horizonte Frontend Premium Squad

## Frontend
- **React 19** — componentes funcionais, hooks nativos, sem class components
- **Vite 8** — bundler, dev server, HMR
- **Tailwind 4** — utility classes + `@theme` tokens em `src/index.css`
- **React Router 7** — roteamento client-side com lazy loading (`src/lazyRoutes.js`)

## Estilos
- `src/index.css` — tokens globais @theme, reset, layout base
- `src/pages/dashboard.css` — shell autenticado (importado pelas páginas)
- `dashboard-theme-dark-*.css` — variantes do tema escuro
- **Regra:** sempre preferir token de `src/index.css` antes de utilitário Tailwind com valor hardcoded

## State & Data
- Context API nativo: `ThemeContext`, `transactionCacheStore`
- Sem Redux/Zustand — não adicionar libs de estado sem aprovação
- Fetch direto com `fetchWithRetry` (`src/lib/fetchWithRetry.js`)

## PWA
- Service Worker: `src/registerServiceWorker.js`
- Manifest: `public/manifest.json`
- Prompt de instalação: `src/components/PwaInstallPrompt.jsx`

## Qualidade
- ESLint configurado em `eslint.config.js`
- Vitest para unit tests (`vitest.config.mjs`)
- `npm run test` = unit + lint + build

## Convenções
- Aliases: `@` = `src/`, `@components` = `src/components/`, `@features` = `src/features/`, `@shared` = `src/shared/`
- Nomes de UI em português (labels, placeholders, mensagens)
- Comentários curtos apenas onde o WHY não é óbvio

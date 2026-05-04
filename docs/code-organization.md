# Code Organization

Este projeto usa uma migração estrutural gradual. A regra principal é preservar comportamento e validar cada fatia antes de mover a próxima.

## Fronteiras

- `src/pages`: apenas componentes ligados diretamente ao router.
- `src/features`: código por domínio de produto quando uma área crescer além de uma página simples.
- `src/components`: componentes globais de shell ou UI reutilizável.
- `src/shared`: utilitários sem JSX compartilhados entre domínios.
- `server/routes`: handlers HTTP por contexto.
- `server/middleware`: preocupações transversais de HTTP, segurança e request lifecycle.
- `server/lib`: domínio, serviços, integrações e persistência do backend.
- `scripts/migrations`: SQL versionado de Supabase.
- `scripts/sql`: SQL manual ou legado que não é migration automática.

## Aliases Frontend

Aliases disponíveis no Vite e no editor:

- `@/*` aponta para `src/*`.
- `@components/*` aponta para `src/components/*`.
- `@features/*` aponta para `src/features/*`.
- `@shared/*` aponta para `src/shared/*`.

Use aliases em arquivos novos e em migrações pequenas. Não misture reorganização de diretórios com refactors funcionais.

## Backend

`server/app.mjs` deve ficar como montador da aplicação Hono. Rotas novas devem nascer em `server/routes`, e helpers transversais em `server/middleware` ou `server/lib/http`.

Fluxo desejado:

```text
route -> service -> repository/integration/domain
```

Rotas não devem importar outras rotas. Repositórios e domínio não devem importar Hono.

## Testes

- Testes de servidor ficam em `server/tests`.
- Testes de UI ou libs do frontend ficam próximos do código em `src`.
- Ao mover código, preserve os testes existentes e rode pelo menos `npm run lint` e `npm run test:unit`.

## Validação

Antes de concluir qualquer fase estrutural, rode:

```bash
npm run lint
npm run audit:dashboard-css
npm run test:unit
npm run build
```

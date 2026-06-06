# Convenções de CSS — tokens + Cascade Layers

> Objetivo: nunca mais ter "guerra de especificidade" (caçar o mesmo valor em 10
> partials, empilhar `!important` por página). Um valor compartilhado mora em
> **um** lugar; quem precisa vencer mora numa **camada**.

## Princípio em uma frase

**Valor compartilhado → token. Override que precisa vencer → `@layer`. Nunca
`!important` por página.**

## 1. Tokens (fonte única)

Valores usados por mais de uma página ficam em `src/pages/dashboard/partials/00-tokens-base.css`
como custom properties em `:root` (e overrides de tema em `body[data-theme='dark']`).

Exemplo — cabeçalho de página (grupo `HUB / HERO`):

```css
:root {
  --page-title-size:   clamp(1.9rem, 4.4vw, 2.7rem);
  --page-title-weight: 800;
  --page-title-line:   1.15;
}
```

Mudar o título de **todas** as páginas = editar o token. Uma linha.

O que **não** vira token compartilhado: valores intencionalmente diferentes por
página (ex.: a **cor** do título, que é por-skin — `--rel-text-hi`,
`--cfg-text-hi`, `--ag-text-hi`, `--pg-text-hi`, `--m-text-hi`).

## 2. Camada autoritativa (`@layer hub`)

Onde os tokens são *aplicados* de forma que vença o CSS legado:
`src/pages/dashboard/partials/38-page-titles-uniform.css`.

```css
@layer hub {
  .dashboard-container[class*="page-"] .dashboard-hub__title,
  .dashboard-container.page-relatorios .rel-ed__title,
  .dashboard-container.agenda-page .agenda-hero__title-row > strong,
  .dashboard-container.page-lista-compras .page-lista-compras__title {
    font-size:   var(--page-title-size) !important;
    font-weight: var(--page-title-weight) !important;
    line-height: var(--page-title-line) !important;
  }
}
```

### Por que isso vence sem seletor gigante

Regra do cascade (CSS Cascade 5): para declarações **`!important`**, uma que está
**dentro de uma `@layer`** tem prioridade **maior** que uma `!important` **fora de
layer** (unlayered), *independente da especificidade*. Como ~todo o CSS do projeto
é unlayered, qualquer regra `!important` dentro de `@layer hub` ganha. Por isso os
seletores aqui podem ser curtos e legíveis.

> ⚠️ Isso só é verdade enquanto `hub` for a única (ou a de maior prioridade entre
> as) layer. Se criar novas layers, declare a ordem explicitamente e revise.

## 3. Regras (o que pode / o que não pode)

- ✅ Novo valor compartilhado do hero → token em `00` + aplicar em `@layer hub` (38).
- ✅ Ajuste que precisa valer em todas as páginas → `@layer hub`.
- ❌ **Nunca** definir tamanho/peso de título com `!important` num partial de skin
  por página (`07`, `13`, `17`, `18`, `20`, `21`, `23`, …). Recria a bagunça.
- ❌ Nunca filtrar "todas menos Dashboard" com `:not(.dashboard-page)`.

## 4. Gotchas descobertos na marra (não repetir)

1. **`dashboard-page` NÃO identifica o Dashboard.** Está em quase todas as páginas
   (é o layout). O Dashboard real é o único container **sem** modificador `page-*`.
   Filtro correto para "todas menos Dashboard": `[class*="page-"]`.
2. **Classes de container são inconsistentes** (ex.: Configurações não tem
   `dashboard-page`; Agenda usa `agenda-page`). Sempre confira a `className` real
   no navegador (DevTools / Playwright) antes de confiar num seletor "esperto".
3. **PWA service worker cacheia CSS.** Ao validar mudança de CSS no navegador,
   limpe `caches` + `serviceWorker` e recarregue, senão vê CSS velho:
   ```js
   for (const k of await caches.keys()) await caches.delete(k);
   for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
   ```
4. **Rota da página de Listas** é `/lista-de-compras` (menu "Listas").
5. **Dashboard** tem cabeçalho próprio (partial `13`) e fica fora da padronização.

## 5. Como estender para outros valores do hero

O mesmo padrão serve para qualquer métrica compartilhada futura (ex.: padding do
hero, tamanho do subtítulo). Passos:

1. Criar o token em `00-tokens-base.css` (grupo `HUB / HERO`).
2. Aplicar em `@layer hub` (partial 38), lendo o token.
3. Remover as definições duplicadas/`!important` que existiam nos partials de skin
   (deixar cor/identidade de skin; tirar só o valor que virou token).
4. Validar no navegador (desktop + mobile), checando que o visual não regrediu.

> Migração é **incremental e segura**: a `@layer hub` já vence o legado, então dá
> para tokenizar uma propriedade por vez sem precisar reescrever tudo de uma vez.

# Arquitetura CSS correta (@layer) + plano de migração — Severino

> Produzido pelo squad Segunda-feira (2026-06-07): cartógrafo de cascata + pesquisador Tailwind v4 + advogado-do-diabo (review adversarial). Consolidado pelo orquestrador.
> **Veredito do conselho: NO-GO para big-bang; GO-CONDICIONAL para a versão estagiada abaixo.**

## 1. Diagnóstico (estado real)

- **5.985 `!important`** em 48 arquivos CSS (`src/`). Distribuição: ~64% skins (partials 13-38), ~32% base (00-12), ~2,5% dark-theme (mirror/polish/fullblack).
- **Causa raiz:** arquitetura "skin-sobre-base" com **tudo unlayered**. Base e skin competem na mesma especificidade; o `!important` é o que faz o skin vencer.
- **Tailwind v4** entra via `@import "tailwindcss"` dentro de `@layer theme, base, components, utilities` → é a parte **mais fraca** da cascata. Todo CSS unlayered do app já o vence.
- Único `@layer` hoje: `@layer hub` no partial 38 (usa `!important` dentro da layer de propósito).
- **Anomalias:** dark-theme importado ANTES dos tokens base (gera 136 `!important` evitáveis); 2 arquivos `16-*` e 2 `17-*` com nomes duplicados.

## 2. A arquitetura correta (alvo)

Ordem de layers declarada **antes** de `@import "tailwindcss"` em `src/index.css`:

```css
@layer theme, base, vendor, components, skin, theme-overrides, utilities;
@import "tailwindcss";
```

| Layer | Conteúdo | Vence | Perde para |
|---|---|---|---|
| `theme` | tokens do Tailwind (@theme) | — | tudo |
| `base` | preflight Tailwind + reset global + **partials base 00-12** | theme | vendor+ |
| `vendor` | line-awesome, fontsource, recharts (se houver CSS) | base | components+ |
| `components` | padrões reutilizáveis (`.card-base`, etc.) | vendor | skin+ |
| `skin` | **partials neumórficos 13-38** (desktop+mobile) | components | theme-overrides+ |
| `theme-overrides` | dark-theme (mirror/polish/fullblack) + overrides de rota | skin | utilities |
| `utilities` | utilitárias do Tailwind (classes de escape no JSX) | tudo | — |

**Regra-chave (CSS spec):** entre layers, a ordem decide (não a especificidade) → o skin vence a base **sem `!important`**. Por isso a migração elimina o `!important` redundante. (Inversamente, `!important` **inverte** a ordem entre layers — daí a layerização ter que ser coerente.)

`@import ... layer(skin)` é suportado nativamente pelo `@tailwindcss/vite`.

## 3. Riscos que MATAM o big-bang (por que NO-GO)

1. **`diff=0` por fingerprint estático é insuficiente** — não pega modais fechados, `:hover/:focus`, `::before/::after`, estados de erro de formulário, print. App financeira: estilo de erro invisível = risco de dado errado.
2. **CSS solto via `import` JS** (`cartoes.css`, `metas.css`, `DashboardInsightsStrip.css`, onboarding/pwa/trial/bem-vindo) fica **unlayered → vence o skin layerizado** → quebra essas rotas; POC dá `diff=0` se não testar exatamente elas.
3. **`@layer hub`** (partial 38) acaba na posição errada (acima de utilities se não declarada; sub-layer de skin se importada dentro) → títulos vencem tudo ou perdem para dark-theme.
4. **`!important` da base vence skin não-important** uma vez layerizado → colisões não mapeadas revertem estilos.
5. **Estado incoerente entre deploys** num PWA com service worker cacheado + iOS safe-area; árvore git suja impede `git bisect`.

## 4. Plano estagiado (GO-CONDICIONAL) — ordem de menor risco

**Pré-condições (todas obrigatórias):**
- **C1.** Harness de fingerprint **completo**: modais ABERTOS, `:hover/:focus` forçados via JS, pseudo-elementos, estados de erro de form, `prefers-reduced-motion`, print — em TODAS as rotas, dual-tema. Validar que ele acusa uma quebra plantada (senão não vale nada).
- **C2.** Árvore git limpa/commitada; branch dedicado.
- **C3.** `@layer hub` resolvido explicitamente na ordem.
- **C4.** Todo CSS solto layerizado junto (ou deixado unlayered **com** fingerprint daquela rota).
- **C5.** Layerização e remoção de `!important` em **deploys separados**.
- **C6.** ✅ **FEITO** — guard de orçamento de `!important` (impede novos).

**Sequência:**
0. ✅ **Estancar o sangramento** — `scripts/check-important-budget.mjs` (baseline 5.985, catraca só-desce) no pre-commit + `npm run ci`. *Captura a maior parte do valor de longo prazo com risco zero.*
1. Construir o harness completo (C1) e provar que detecta quebra plantada.
2. Limpar árvore git + branch `chore/css-layers` (C2).
3. Layerizar **só a base (00-12)** em `@layer base` (skin segue unlayered, continua vencendo). Fingerprint completo em todas as rotas+modais. Reversível em 1 arquivo.
4. Só se 3 = limpo: layerizar o **skin** em `@layer skin`, resolvendo `hub` + CSS solto (C3/C4). Deploy isolado, rollback ensaiado.
5. **Remoção de `!important`: oportunística**, não um sprint de 41 partials — quando tocar um partial por outro motivo, remove os dele e fingerprinta. (O valor de não criar o próximo já está capturado no passo 0.)

## 5. Recomendação do orquestrador

Executado agora: **passo 0** (risco zero). O restante (passos 1-5) é um **projeto dedicado** de várias sessões/deploys numa app financeira em produção — só deve começar com decisão informada do CEO, pois o conselho que convoquei classificou o big-bang como **NO-GO** e o caminho seguro exige construir o harness completo antes de tocar em qualquer layer. O ganho é **manutenibilidade** (dívida técnica), não correção de bug — ROI lento e indireto. A catraca do passo 0 garante que a dívida **não cresce** enquanto a migração não acontece.

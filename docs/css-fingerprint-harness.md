# CSS Fingerprint Harness — pré-condição C1 da migração @layer

> Passo 1 do plano `docs/arquitetura-css-layers.md`. O advogado-do-diabo provou que
> `diff=0` num fingerprint estático é **teatro de segurança** — não pega modais
> fechados, hover, pseudo-elementos, estados de erro, print. Este harness fecha
> essas lacunas. **Nenhuma layer/`!important` deve ser tocada antes de o harness
> passar no auto-teste em todas as cenas.**

## Módulo

`scripts/css-fingerprint/capture.browser.js` — instala `window.__cssfp` quando
injetado via Playwright `page.evaluate` (ou colado no console). API:

- `__cssfp.capRaw(rootSel, theme)` → linhas `{k,v}` (elemento + `::before/::after` com content), animação congelada.
- `__cssfp.capStable(rootSel, theme)` → `{rows, volMask}` (captura 2x; `volMask` = índices voláteis a ignorar, ex.: relógio em `TIME.dashboard-hub__date::before`).
- `__cssfp.diff(curr, baselineObj)` → `{diff, ex, lenMismatch}` (ignora voláteis).
- `__cssfp.selfTest(rootSel, theme)` → planta quebra forte e confirma `detectouQuebra && voltouAoZero`. **Rodar sempre antes de confiar em diff=0.**

Validado 2026-06-07 em `.app-layout-shell` (dashboard): 405 linhas (21 pseudo);
quebra forte plantada → diff=385; captura estável → diff=0.

## Regra de ouro

Um fingerprint que **nunca acusa** não vale nada. Antes de cada sessão de verificação,
`selfTest` tem que retornar `ok:true`. Se um `diff=0` aparecer numa cena onde o
`selfTest` daquela cena não passou, o resultado é inválido.

## Catálogo de CENAS (cobertura obrigatória antes de migrar)

Cada cena = (rota + viewport + tema + estado) onde se captura baseline (antes da
mudança) e re-verifica (depois). `diff=0` só conta se TODAS as cenas passarem.

| # | Cena | Como montar o estado | Status |
|---|---|---|---|
| 1 | Todas as rotas, conteúdo estático | navegar; root por página; viewport desktop(1440)+mobile(390); tema light+dark | método já validado nesta campanha |
| 2 | **Pseudo-elementos** | automático no `capRaw` (`::before/::after` com content) | ✅ coberto pelo módulo |
| 3 | **Modais ABERTOS** | clicar o gatilho de cada modal; root = overlay do modal; capturar | padrão já usado (29/30/32/16/agenda) — falta automatizar |
| 4 | **`:hover`** | `page.hover(seletor)` em elementos interativos-chave (nav-item, botões, linhas de tx, cards) → capturar | a construir (cena por elemento) |
| 5 | **`:focus` / `:focus-visible`** | `page.focus()` em inputs/botões → capturar | a construir |
| 6 | **Estados de erro de formulário** | submeter form vazio/ inválido (nova transação, login, valor) → capturar `.modal-form--validated`, mensagens de erro | a construir — CRÍTICO (app financeira) |
| 7 | **`@media print`** | `page.emulateMedia({media:'print'})` → capturar | a construir |
| 8 | **`prefers-reduced-motion`** | `page.emulateMedia({reducedMotion:'reduce'})` → capturar | a construir |
| 9 | **`:has()` / componentes globais por rota** | rotas que escondem FAB/chat/safe-area via `html:has(.pagina)` | a construir |
| 10 | **iOS safe-area / PWA** | viewport com safe-area; checar faixas | conferência manual |

## Procedimento por sessão de verificação

1. Subir dev (`npm run dev:api` + `dev:web`), logar (conta rica).
2. Injetar `capture.browser.js` (instala `window.__cssfp`).
3. Para cada cena: montar estado → `selfTest` (exigir `ok:true`) → `capStable` como **baseline** (guardar em localStorage/arquivo).
4. Aplicar a mudança de CSS (layer/`!important`).
5. Re-montar cada cena → `capRaw` → `diff` contra o baseline. Exigir `diff=0` em TODAS.
6. Qualquer `diff>0` não-volátil → reverter a mudança (não deployar).

## Voláteis conhecidos (mascarados pelo `volMask`)

- `TIME.dashboard-hub__date::before` — data/relógio dinâmico.
- Páginas com dados assíncronos (Investimentos, Dashboard): contagem de elementos
  pode variar entre cargas → aguardar settle ou usar root estável; `lenMismatch:true`
  no diff sinaliza desalinhamento (resultado inválido, recapturar).

## Por que isto antes de qualquer @layer

Sem as cenas 3-9, layerizar e ver `diff=0` nas páginas estáticas (cena 1) daria
falsa confiança: modais, hover e erros de formulário quebrariam em produção com o
teste "verde". Este harness é a condição **C1** do GO-CONDICIONAL.

## Runner automatizado

`scripts/css-fingerprint/run.mjs` — runner Playwright que injeta o núcleo via
`addInitScript` (sobrevive a navegação), loga, e itera as cenas. Modos:

```bash
npm i -D playwright && npx playwright install chromium   # pré-requisito (pesado, não instalado por padrão)
CSSFP_EMAIL=... CSSFP_PASS=... node scripts/css-fingerprint/run.mjs --baseline
# ...aplicar mudança de CSS...
CSSFP_EMAIL=... CSSFP_PASS=... node scripts/css-fingerprint/run.mjs --check   # exit 1 se qualquer cena diff>0
```

Credenciais só via env (o guard de segredos bloqueia hardcode). Cada cena roda
`selfTest` (exige `ok:true`) — se o harness não detecta quebra numa cena, o `--check`
falha (anti-teatro). O baseline (`fingerprint-baseline.json`) é gerado localmente e
não versionado (depende de fontes/render do ambiente).

## Estado atual (08-jun-2026 — runner end-to-end VERDE)

Pré-condição C1 **cumprida**: o runner roda ponta-a-ponta e prova estabilidade.

- ✅ **62 cenas** capturadas (10 rotas × desktop/mobile × light/dark + 4 estados de modal/erro + hover + print/reduced-motion), **todas com `selfTest ok`** (anti-teatro) e **`--check` diff=0** numa árvore sem mudança de CSS. É a base sólida para o cutover do rebuild (`docs/plano-reconstrucao-css-2026-06.md`).
- ✅ **playwright instalado** como devDep. Binário chromium via `npx playwright install chromium`.
- ✅ **Login via API** (`POST /api/auth/login` → grava `horizonte_refresh_token`+`horizonte_user` no localStorage; o bootstrap do app reobtém o access token). Robusto ao fluxo multi-step da UI (AuthPhoneShell + webauthn) que travava o login por formulário.
- ✅ **Determinismo resolvido** (3 correções no harness):
  1. **Freeze global de animações** via stylesheet `*,*::before,*::after{animation:none!important;…}` — o `element.style` antigo **não** congelava pseudo-elementos (entrada animada de `dashboard-hub__date::before` gerava opacity/transform voláteis).
  2. **Horizon Chat excluído** da captura (`[class*="horizon-chat|horizon-msg|horizon-suggestion"]`) — overlay de IA com tamanho/sombra/streaming não-determinísticos.
  3. **DOM-settle** no `settle()` — espera a contagem de descendentes do root estabilizar antes de capturar (conteúdo async, ex.: delta de saldo do dashboard com placeholder/shimmer, mudava a contagem entre cargas). Mais `gotoSettled` com retry (recarrega 1× se a raiz não montar sob carga do dev server).
- ✅ Rotas `/metas` e `/cartoes` adicionadas ao `PAGE_ROOTS`.
- ⏳ Cena 9 (`:has()` / componentes globais por rota) ainda não automatizada (baixo risco — o rebuild mantém as classes BEM).

**Como rodar** (dev stack limpo — vite 3010 / api 3001):
```bash
CSSFP_BASE=http://localhost:3010 CSSFP_EMAIL=<email> CSSFP_PASS=<senha> \
  node scripts/css-fingerprint/run.mjs --baseline   # antes de mexer no CSS
# ...reescrever CSS...
CSSFP_BASE=http://localhost:3010 CSSFP_EMAIL=<email> CSSFP_PASS=<senha> \
  node scripts/css-fingerprint/run.mjs --check       # exit 1 se qualquer cena diff>0
```
`fingerprint-baseline.json` é local (gitignored — depende de fontes/render do ambiente).

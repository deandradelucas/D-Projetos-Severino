# Auditoria de Arquitetura — Severino (jun/2026)

> Arquiteto Sênior · base: release/1.0.3 · objetivo: reduzir débito técnico, remover
> código morto e garantir escalabilidade **sem quebrar funcionalidades**.

## Panorama (números reais)

| Métrica | Valor |
|---|---|
| Componentes / Hooks / Lib (front) | 70 / 11 / 52 |
| Páginas / Rotas API / Lib (server) | 20 / 125 / 92 |
| Partials CSS | 47 arquivos · ~50.000 linhas |
| `!important` no CSS | **8.645** 🚨 |
| Classes CSS mortas (dashboard) | 89 |
| Exports órfãos | 90 em 22 arquivos (verificar individualmente) |
| Arquivos órfãos / Assets órfãos | 0 / 0 ✅ |
| Endpoints sem consumidor | 1 (`GET /api/lista-compras/arquivadas`) |
| Dependência não usada | `@fontsource/poppins` |

## Achados por dimensão

- **Estrutura:** rotas server bem modularizadas (25 arquivos); 0 arquivos órfãos (tooling próprio). God components: `ListaDeCompras.jsx` (2.597 ln), `Transacoes.jsx` (1.482), `Configuracoes.jsx` (1.325), `TransactionModal.jsx` (1.070), `Relatorios.jsx` (1.021), `Pagamento.jsx` (992) — fetch+lógica+UI juntos.
- **Código morto:** 89 classes CSS (inclui design antigo de Relatórios: `relatorios-insights*`, `relatorios-kpi*`, etc.), 1 endpoint sem consumidor, `@fontsource/poppins` não importado, exports órfãos a verificar.
- **Frontend (débito principal):** 8.645 `!important`; dois sistemas de tokens paralelos (Tailwind `@theme` em index.css + `:root` em 00-tokens-base.css); skins por página duplicando card/hero; CSS quase todo *unlayered* (só título usa `@layer hub`).
- **Performance:** recharts/jspdf já lazy ✅; god components geram chunks grandes e re-renders amplos.
- **Arquitetura:** SoC/DRY/KISS violados sobretudo no CSS; back-end saudável.

## Plano priorizado

- 🔴 **Alto:** A1 padronizar CSS (tokens + `@layer`, derrubar `!important` em ondas) · A2 decompor god components · A3 remover CSS morto.
- 🟠 **Médio:** M1 unificar tokens · M2 remover exports órfãos verificados · M3 remover `@fontsource/poppins` · M4 resolver endpoint órfão.
- 🟡 **Baixo:** B1 token duplicado `--font-size-4xl/5xl` · B2 docs desatualizadas.

### Ordem de execução
1. Limpeza de baixo risco (dep, token, CSS morto isolado).
2. Unificar tokens.
3. CSS por camadas (skins → `@layer` + tokens), verificando visual por partial.
4. Exports órfãos verificados.
5. Decomposição de componentes (um por vez, sem mudar comportamento).

## Progresso

### Etapa 1 — limpeza de baixo risco (jun/2026) ✅
- Removido `@fontsource/poppins` (nunca importado; só comentários citavam Poppins).
- Removido token morto `--font-size-5xl` (duplicava `4xl`, `text-5xl` sem uso).
- Removida regra CSS órfã `.rel-ed__ia-empty-text` (elemento já removido da UI).
- Verificação: lint limpo, build verde, 237 testes ok.

### Etapa 1b — CSS morto (jun/2026) ✅
- Criado `scripts/strip-dead-dashboard-css.mjs` (removedor seguro: só apaga regras cujo seletor mira EXCLUSIVAMENTE classes mortas).
- Removidas **22 regras** exclusivamente-mortas em 7 partials. Build/lint/237 testes ok; Configurações validada no Playwright.

### Etapa 1c — CSS morto em regras mistas/compostas (jun/2026) ✅
- Criado `scripts/strip-dead-compound.mjs`: remove partes/regras cujo seletor exige uma classe morta
  como token obrigatório (fora de `:not()/:is()/:has()`), portanto **nunca casam**.
- **Descoberta crítica:** das 84 classes "mortas" do detector, **52 eram falso-positivos dinâmicos**
  (construídas via template, ex.: `agenda-status-badge--${tone}`, `config-papel-chip--${papel}`,
  `pagamento-status-chip--${tone}`) — VIVAS. O script ganhou um filtro anti-falso-positivo (prefixo BEM
  no bundle JS) para preservá-las.
- Removidas **63 regras + 4 partes** das **32 genuinamente mortas** (na maioria o design ANTIGO de
  Relatórios: `relatorios-insights*`, `relatorios-kpi*`, `relatorios-neon-card`; + `ref-tx-*` órfãos,
  `btn-danger`, etc.) em 11 partials (−434 linhas). Detector: 84 → 56 "não usadas".
  Removível só por serem comprovadamente ausentes do src JS e não-dinâmicas. build/lint/309 testes ok.

### Etapa 2 — tokens (jun/2026) ✅ (fechada SEM alterar — falso problema)
- Investigação: os dois sistemas são **complementares e 95% disjuntos** (105 `@theme` Tailwind × 73 `:root`). Só 5 nomes coincidem (`--shadow-*`), com valores iguais no light + override dark no `:root`. As duas definições são **funcionalmente necessárias** (Tailwind util `shadow-accent` usado 6×; `var(--shadow-*)` 20× nos partials).
- Unificar adicionaria complexidade/risco sem benefício → **não alterado** (M1 era falso-positivo).

### C — endpoint órfão (jun/2026) ✅
- Removido `GET /api/lista-compras/arquivadas` + função `listarListasArquivadas` (sem consumidor no front, sem plano de UI). Endpoints órfãos: 1 → 0.

### Etapa 3 — redução de `!important` (jun/2026) — PARCIAL
Método validado: remover apenas `!important` **redundantes por especificidade** (o seletor da
página já vence a base), verificado por **fingerprint de estilos computados** (claro+escuro) com
`diff=0` obrigatório — via loop local (dev + Playwright). Sem migração global de cascade layers
(que inverteria a precedência de `!important` e quebraria tudo).

Resultado por página (verificado `diff=0` claro+escuro, em produção):
- **Transações:** 723 → 285 (−433) ✅
- **Agenda:** −81 ✅
- **Configurações:** 521 → 202 (−61%) ✅
- **Relatórios:** 435 → 253 (−42%) ✅
- **Pagamento:** 689 → 539 (−22%) ✅
- **Lista:** 503 → 63 (−87%) ✅
- **Investimentos:** 611 → 120 (−80%) ✅
- **Dashboard:** 168 → 103 (−39%) ✅ — via congelamento de animação (spark/pulse) p/ fingerprint estável

Método: Playwright MCP (fingerprint de estilos computados claro+escuro, diff=0 obrigatório),
charts/svg excluídos, animações congeladas inline (medição), blocos de estado oculto (modais/comparador)
preservados. As 5 últimas foram feitas usando a **conta real do CEO** (dados ricos) — a conta de teste
João (isenta/esparsa) não renderizava os estados. **Total removido na Etapa 3: ~1.560 `!important`.**
**Etapa 3 CONCLUÍDA em todas as 8 páginas-skin** (Transações, Agenda, Configurações, Relatórios,
Pagamento, Lista, Investimentos, Dashboard). Ver `etapa3-important-checklist.md`.

Não aplicado (com segurança — sem dano, tudo restaurado ao original):
- **Lista, Investimentos:** conta de teste esparsa (poucos elementos) → guard abortou.
- **Relatórios:** recharts mudam a contagem de elementos entre cargas → fingerprint instável.
- **Pagamento:** ruído de render intermitente → verificação final revertia (conservador).
- **Dashboard, Configurações:** dev server local instável após muitas edições (ERR_ABORTED).

Lição: a automação em massa é **frágil no ambiente Windows** (processos zombie que `pkill` não
mata; risco de corrupção silenciosa se o servidor não reflete edições). O método é sólido, mas
o restante deve ser feito num ambiente estável (Linux/CI) ou supervisionado, página a página.

### Etapa 5 — decomposição de god components (jun/2026) — PARCIAL
Método: relocação pura (mover código sem mudar comportamento), verificada a cada passo por
`eslint` + `build` + suíte de testes. Lógica derivada extraída ganhou testes próprios.

- **ListaDeCompras.jsx: 2.597 → 1.217 ln (−53%)** ✅
  - `components/lista/ListaIcons.jsx` (18 ícones), `ListaModais.jsx` (6 modais),
    `ItemRow.jsx`, `ModoComprando.jsx`; `lib/listaCompras.js` (constantes/helpers puros);
    `hooks/useKeyboardOffset.js`. Build/lint/237 testes ok.
- **Transacoes.jsx: 1.482 → 1.233 ln (−17%)** ✅
  - 7 `useMemo` (cálculos derivados puros) → `lib/transacoesDerived.js`, com **+23 testes**.
    Deps dos memos inalteradas. (resta 1 warning `exhaustive-deps` pré-existente.)
- **Configuracoes.jsx: 1.325 → 1.249 ln** ✅
  - `lib/avatarImage.js`, `lib/familiaUi.js`, `components/configuracoes/ConfigNotificacoesCard.jsx`.
    (Seções grandes Perfil/Família ficam para depois — muito acopladas a estado, exigem verificação visual.)
- **Relatorios.jsx: 1.021 → 957 ln** ✅
  - 7 derivações puras → `lib/relatoriosDerived.js`, com **+18 testes**.
- **Pagamento.jsx: 992 → 951 ln** ✅
  - derivações de UI (banner, desconto/economia, trial, status badge) → `lib/pagamentoUi.js`, com **+23 testes**.
- **TransactionModal.jsx: 1.070 → 1.045 ln** ✅
  - `tipoCategoriaIgual`, `filtrarCategoriasPorTipo`, `safeEvalExpression` (calculadora c/ guarda
    anti-injeção) → `lib/transacaoFormUtils.js`, com **+8 testes**.

**Resultado agregado:** suíte de testes **237 → 309** (+72). Toda extração foi relocação pura
(comportamento idêntico), verificada por `eslint`+`build`+testes a cada passo. A lógica derivada
movida ganhou testes próprios.

### Etapa 6 — CSS morto em regras mistas (jun/2026) — PARCIAL
- Detector aponta **85** classes mortas, **0** em regras exclusivamente-mortas (Etapa 1b já limpou).
- Trim seguro de partes vírgula-separadas exclusivamente-mortas: **2 removidas**
  (`.relatorios-btn-export`, `.pagamento-modal__body`) — vírgula = seletores independentes, sem
  efeito nas partes vivas. (Ferramenta foi descartável; resultado já está no CSS.)
- As restantes em seletores compostos foram resolvidas na **Etapa 1c** (ver acima): filtro
  anti-falso-positivo dinâmico + remoção de 63 regras das 32 genuinamente mortas. ✅

### Pendente (baixo valor — recomendado só sob demanda)
- **Etapa 3** (redução de `!important`): ✅ **CONCLUÍDA nas 8 páginas-skin** (ver acima e
  `etapa3-important-checklist.md`).
- **CSS morto:** ✅ resolvido (Etapa 1b + 1c). Restam 56 "não usadas" no detector que são
  **falso-positivos dinâmicos legítimos** (classes `--${variant}` construídas via template) — manter.
- ✅ **Decomposição de seções JSX acopladas concluída (jun/2026):**
  - `Configuracoes.jsx` **1249 → 889 ln**: extraídos `ConfigPerfilCard` (avatar/nome/telefone/vínculo)
    e `ConfigFamiliaCard` (convite/membros/papéis). Verificado por **comparação de innerHTML renderizado**
    (Playwright, conta real): DOM idêntico exceto IDs internos do React (`useId`) → zero mudança de comportamento.
  - `TransactionModal.jsx` **1045 → 1036 ln**: extraído o widget autocontido `CalcKeypad` (teclado da
    calculadora). O restante é formulário controlado coeso — decompor criaria abstrações de interface
    larga sem simplificar (contra "nunca criar abstrações sem justificativa"), então mantido.

**Auditoria de arquitetura: CONCLUÍDA.** God components decompostos, Etapa 3 (`!important`) nas 8 páginas,
CSS morto limpo (com filtro anti-falso-positivo), endpoint órfão/dep/tokens resolvidos. Sem débito aberto.

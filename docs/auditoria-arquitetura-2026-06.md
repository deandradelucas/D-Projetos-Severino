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
- Restam ~67 classes mortas em regras "mistas" (classe morta + viva no mesmo seletor) → passo futuro mais cirúrgico.

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

Resultado por página (verificado `diff=0`, em produção):
- **Transações:** 723 → 285 (−433) ✅
- **Agenda:** −81 ✅
- **Configurações:** 521 → 202 ocorrências (−61%) ✅ — tentativa 3 (jun/2026), via Playwright MCP
  (fingerprint claro+escuro, diff=0), modal de exclusão preservado. Ver `etapa3-important-checklist.md`.

Bloqueado pela conta de teste (João isento/esparso) — exigem conta paga/rica + abrir modais:
- **Pagamento:** isento → só 45 elementos (UI de preços/checkout oculta).
- **Lista/Investimentos:** sem dados → conteúdo esparso.
- **Relatórios/Dashboard:** charts/animações (recharts, shimmers de delta) → ruído; Dashboard exigiria
  máscara de voláteis (risco de falso-negativo) → adiado por conservadorismo.

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
- As **~83 restantes** vivem em seletores **compostos** (`.live.dead`, `.live .dead`): não matcham
  (a classe morta nunca está no DOM), mas removê-las exige editar seletores compostos à mão — baixo
  valor, risco de erro de parsing. Deixado para limpeza manual pontual.

### Pendente (baixo valor / alto atrito — recomendado só sob demanda)
- **Etapa 3** (redução de `!important`) nas páginas restantes — frágil neste ambiente Windows
  (ver `etapa3-important-checklist.md`); exige fingerprint visual (Playwright) + cobertura de estados
  ocultos. Sem benefício funcional/UX. Feito só em Transações e Agenda.
- **~83 classes CSS mortas** em seletores compostos — cosmético.
- Decomposição mais profunda (seções de JSX) de `Configuracoes.jsx` (Perfil ~170 ln, Família ~260 ln)
  e `TransactionModal.jsx` — exige verificação visual por serem muito acopladas a estado/handlers.

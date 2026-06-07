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

Não aplicado (com segurança — sem dano, tudo restaurado ao original):
- **Lista, Investimentos:** conta de teste esparsa (poucos elementos) → guard abortou.
- **Relatórios:** recharts mudam a contagem de elementos entre cargas → fingerprint instável.
- **Pagamento:** ruído de render intermitente → verificação final revertia (conservador).
- **Dashboard, Configurações:** dev server local instável após muitas edições (ERR_ABORTED).

Lição: a automação em massa é **frágil no ambiente Windows** (processos zombie que `pkill` não
mata; risco de corrupção silenciosa se o servidor não reflete edições). O método é sólido, mas
o restante deve ser feito num ambiente estável (Linux/CI) ou supervisionado, página a página.

### Pendente
- Etapa 3 nas páginas restantes (Relatórios/Pagamento/Dashboard/Configurações/Investimentos/Lista) — em ambiente estável.
- ~67 classes CSS mortas em regras mistas.
- Decompor god components (`ListaDeCompras.jsx` 2.597 ln, etc.).

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

### Pendente (próximas etapas)
- Etapa 1b: varrer as 89 classes CSS mortas (espalhadas em 8 partials; mistura morto/vivo — exige passo classe-a-classe com re-auditoria).
- Endpoint `GET /api/lista-compras/arquivadas`: implementação completa, **sem consumidor no front** — confirmar se é feature planejada antes de remover.
- Demais etapas (tokens, layers, god components) conforme plano.

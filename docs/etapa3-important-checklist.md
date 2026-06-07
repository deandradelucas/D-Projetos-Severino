# Etapa 3 — Checklist para retomar a redução de `!important`

> Objetivo: reduzir os `!important` redundantes dos skins por página **sem nenhuma
> mudança visual** (`diff=0`). Método já validado em Transações e Agenda.
> Complementa `docs/auditoria-arquitetura-2026-06.md` e `docs/design/css-conventions.md`.

## Princípio (o que é seguro remover)

Remover **somente** `!important` **redundantes por especificidade**: regras de página
(`body[data-theme] .dashboard-container.page-X… {…}`, especificidade ~0,6,1) já vencem a
base **sem** o `!important`. Os *load-bearing* (que resolvem conflitos de mesma
especificidade) **ficam**. Nunca fazer migração global de cascade layers (inverte a
precedência de `!important` e quebra tudo).

## Status por página

| Página | Skin | Status |
|---|---|---|
| Transações | `15-transacoes-neumorphic-desktop.css` | ✅ 723→285 |
| Agenda | `18-agenda-neumorphic-desktop.css` | ✅ −81 |
| Relatórios | `17-relatorios-neumorphic-desktop.css` (435) | ⏳ pendente — recharts mudam contagem de elementos |
| Pagamento | `20-pagamento-neumorphic-desktop.css` (259) | ⏳ pendente — ruído de render intermitente |
| Configurações | `21-configuracoes-neumorphic-desktop.css` (189) | ⏳ pendente — dev local instável |
| Dashboard | `13-dashboard-neumorphic-desktop.css` (168) | ⏳ pendente — idem |
| Investimentos | `16/17-investimentos-neumorphic-desktop.css` | ⏳ pendente — conta de teste esparsa |
| Lista | `19-lista-compras-neumorphic-desktop.css` (503) | ⏳ pendente — conta de teste sem listas |
| Sidebar / Modais | `14-sidebar…`, `16-modal-nova-tx…` | ⏳ pendente — exigem estados (modal aberto) |

## Pré-requisitos (por que falhou no Windows)

1. **Ambiente estável** — preferir Linux/CI/container. No Windows o `pkill` do git-bash
   não mata node → processos zombie e dev server instável após muitas edições.
2. **Conta de dados rica** — usar uma conta com transações, listas, investimentos,
   eventos e (em Pagamento) histórico, para os elementos existirem no fingerprint.
   (A conta de teste João é esparsa → guard aborta páginas vazias.)
3. **Página estável** — Relatórios usa recharts (a contagem de elementos varia entre
   cargas). Para incluí-la: desabilitar animações dos charts no teste, ou excluir
   `.recharts-*` do fingerprint, ou usar tolerância por máscara mais robusta.

## Procedimento (por página)

1. Subir UM dev server (`npm run dev`) e anotar a porta do Vite.
2. Para a página alvo, no navegador (Playwright), logar e capturar **baseline**:
   estilos computados de `.ref-dashboard-inner *` em **claro e escuro**.
   - **Guard:** se baseline < 50 elementos → abortar (dados insuficientes).
   - **Máscara de voláteis:** capturar 3× e ignorar índices que variam sozinhos.
   - **Self-check servidor-vivo:** remover TODOS os `!important` do arquivo; o diff
     tem de ser > 0 (servidor reflete edições) e, ao restaurar, diff = 0. Senão abortar.
     (Sempre restaurar o arquivo num `finally` — um FATAL no meio deixa o arquivo stripado.)
3. **Bisecção** por faixas de linha: remover `!important` da faixa, recarregar, medir diff.
   - `diff = 0` → faixa redundante: manter removido.
   - `diff > 0` e faixa pequena (≤ ~24 linhas) → load-bearing: restaurar.
   - senão → dividir ao meio e recursar. (Cap de tempo opcional por arquivo.)
4. **Verificação final:** com o estado aceito, recarregar e exigir `diff = 0`. Se ≠ 0,
   reverter o arquivo inteiro (não commitar).
5. Rodar `npm run lint && npm run build && npm run test:unit`.
6. Commitar **um arquivo por commit** (`refactor(css): Etapa3 - <pagina> reduz !important`).
7. Deploy (frontend: `git pull` + `npx vite build` + `pm2 restart severino` na VPS).
8. Conferir a página em produção (claro + escuro).

## Critério de "feito"
- `diff = 0` no fingerprint (claro+escuro) **e** conferência visual em produção.
- `npm run lint/build/test:unit` verdes.

## Observação
O script de automação foi **temporário** e removido (dependia de `playwright-core` +
Chrome do sistema). Recriar a partir deste procedimento se for retomar. O método em si
é confiável; o gargalo foi o ambiente, não a abordagem.

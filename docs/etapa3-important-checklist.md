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
| Configurações | `21-configuracoes-neumorphic-desktop.css` | ✅ **521→202 ocorrências (−61%)** — diff=0 claro+escuro (Playwright), modal de exclusão (386-424) preservado inteiro |
| Relatórios | `17-relatorios-neumorphic-desktop.css` (435) | ⛔ bloqueado — recharts + precisa de transações (conta João esparsa) |
| Pagamento | `20-pagamento-neumorphic-desktop.css` (689) | ⛔ bloqueado — João é isento → só 45 elementos (UI de preços/checkout é estado oculto; ~95% dos !important não renderizam) |
| Dashboard | `13-dashboard-neumorphic-desktop.css` (168) | ⚠️ adiado — renderiza (307 elem), mas tem 22 spans animados (delta) → exige máscara de voláteis = risco de falso-negativo; não deployado por conservadorismo |
| Investimentos | `16/17-investimentos-neumorphic-desktop.css` | ⛔ bloqueado — conta de teste esparsa |
| Lista | `19-lista-compras-neumorphic-desktop.css` (503) | ⛔ bloqueado — João sem listas |
| Sidebar / Modais | `14-sidebar…`, `16-modal-nova-tx…` | ⏳ exigem estados (modal aberto) |

### Tentativa 3 (jun/2026) — método validado e 1 página entregue
- **Método confirmado funcional neste ambiente** com Playwright MCP: fingerprint de estilos
  computados (66 props × todos os elementos), baseline em `localStorage` (sobrevive ao HMR),
  self-check (strip total → diff>0 → restore → diff=0), bisecção por faixa de linhas.
- **Configurações entregue** (−61%, deployado HEAD 9b94fff). Load-bearing isolado: hero/nav/profile
  (linhas 1-106), cards de tema (162-182), botão danger (278-281) — todos preservados.
- **Aprendizado novo:** o dev server faz **full-reload no HMR** (perde a sessão → cai no /login às vezes);
  contornado com baseline no localStorage + re-login. E o **fingerprint só vê o DOM renderizado** —
  páginas com estado oculto (Pagamento isento, modais) ou conteúdo esparso (Lista/Investimentos sem
  dados) **não são verificáveis** com a conta João; exigiriam conta paga/rica + abrir cada modal.

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

## ⚠️ LIÇÃO CRÍTICA — ponto-cego de estados ocultos

O fingerprint só mede o **DOM atualmente renderizado**. Ele NÃO vê:
- **Modais / overlays fechados** (Pix, cancelar, criar item, detalhe de transação).
- Estados condicionais (planos, banners de trial, hover, foco, empty vs cheio).

Consequência real observada: em **Pagamento**, remover quase todos os `!important`
deu `diff=0` (a remoção total só mudou **3** elementos visíveis) — porque ~95% dos
`!important` de `20-pagamento` são dos **modais** (não renderizados na tela do João).
Aceitar isso teria **quebrado os modais Pix/cancelar**. Foi **revertido**.

Regras para evitar:
1. Antes de processar um partial, checar se ele estiliza modais/estados:
   `grep -ciE "modal|overlay|drawer|portal" <partial>`. Se > 0, **abrir e testar cada
   estado** (modal aberto, etc.) durante o fingerprint, ou pular o partial.
2. Se o self-check "remoção total" mudar **pouquíssimos** elementos (ex.: < 10) num
   partial grande, **desconfiar**: provavelmente a maioria dos `!important` é de estados
   ocultos → não remover sem testar esses estados.
3. `15-transacoes` tem 0 regras de modal → seguro. `18-agenda` tem 35 (modal de evento),
   mas o modal foi testado em produção e ficou íntegro. `20-pagamento` tem modais → exige
   testar os modais.

## Tentativa 2 (jun/2026) — desfecho
- **Pagamento:** `diff=0` enganoso (estados ocultos) → revertido. Não fazer sem testar modais.
- **Relatórios:** recharts instabilizam o fingerprint (diff final alto) → revertido.
- **Dashboard / Configurações:** conteúdo assíncrono/volátil demais (alto ruído) → abortado.
- **Lista / Investimentos:** conta de teste esparsa → guard abortou.
- Nenhum dano (tudo restaurado). Só **Transações** e **Agenda** seguem reduzidos.

## Observação
O script de automação foi **temporário** e removido (dependia de `playwright-core` +
Chrome do sistema). Recriar a partir deste procedimento se for retomar — agora também
**cobrindo estados ocultos (modais)** e excluindo `svg`/`.recharts-*` do fingerprint.
O método é confiável para conteúdo estático/visível; o gargalo é ambiente + estados ocultos.

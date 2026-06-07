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
| Configurações | `21-configuracoes-neumorphic-desktop.css` | ✅ **521→202 (−61%)** — diff=0 (Playwright), modal exclusão (386-424) preservado |
| Relatórios | `17-relatorios-neumorphic-desktop.css` | ✅ **435→253 (−42%)** — conta real; charts/svg excluídos; filtros+cards+legendas preservados |
| Pagamento | `20-pagamento-neumorphic-desktop.css` | ✅ **689→539 (−22%)** — conta real (não-isenta); só features de conversão (444-563); modais Pix/cancelar (1-80, 564-601) preservados inteiros |
| Lista | `19-lista-compras-neumorphic-desktop.css` | ✅ **503→63 (−87%)** — conta real; skin visível 100% redundante; modais (690-788) preservados; HMR confirmado por sentinel |
| Investimentos | `16+17-investimentos-neumorphic-desktop.css` | ✅ **611→120 (−80%)** — conta real; partial 17 100% redundante; resumo-bg + comparador/modal preservados |
| Dashboard | `13-dashboard-neumorphic-desktop.css` | ✅ **168→103 (−39%)** — conta real; **congelamento de animação** (spark/pulse via inline `animation:none!important`) p/ incluir KPI cards no fingerprint sem ruído; diff=0; load-bearing espalhado (container/scroll/hero-bg + KPI/tx-bg) preservado |
| Sidebar / Modais | `14-sidebar…`, `16-modal-nova-tx…` | ⏳ exigem estados (modal aberto) |

### Tentativa 5 (jun/2026) — Dashboard via congelamento de animação
O ruído dos contadores de delta (spark placeholders + pulse dots) era **animação**, não async.
Solução: injetar `animation:none!important; transition:none!important` inline em todos os elementos
antes de capturar → estabiliza (0/0 entre calls) **incluindo** os elementos animados, eliminando a
necessidade de máscara de índice (que tinha risco de falso-negativo). O congelamento é só no
navegador (medição); o CSS em produção mantém as animações. Resultado: 168→103, diff=0, deployado.
**Etapa 3 concluída em todas as 8 páginas-skin.**

### Tentativa 4 (jun/2026) — desbloqueio com conta real (CEO)
Com a conta do CEO (dados ricos, não-isenta) as páginas antes bloqueadas pela conta de teste
João renderizaram completas. **+4 páginas entregues** (Relatórios, Pagamento, Lista, Investimentos),
todas com `diff=0` claro+escuro via Playwright, charts/svg/shimmer excluídos do fingerprint, e os
blocos de estado oculto (modais/comparador) preservados integralmente por não serem mensuráveis sem
acionar ações destrutivas (Pix/cancelar) na conta real. Padrão consistente: o skin **visível** é em
grande parte `!important` redundante por especificidade; o **load-bearing** concentra-se em poucos
blocos de fundo de painel (dark) + estados ocultos. Só **Dashboard** segue pendente (contadores animados).

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

### Investigação MOBILE (jun/2026) — passo #1 da re-auditoria
Método validado em viewport 390×844 (login conta real, freeze de animação, exclusão de
spark/pulse/shimmer, root `.page-transacoes`, estável 0/0 com 728 elementos).

**Achado decisivo:** o maior partial mobile, `26-mobile-transacoes-fix` (503 `!important`),
é **quase 100% load-bearing** — strip total muda **324/728** elementos; metade-1 (1-307) muda 186,
metade-2 (308-615) muda 144. **Não há faixa redundante material.** Restaurado sem alteração.

**Causa-raiz (confirmada):** o `!important` mobile é *estrutural* — o skin mobile e o CSS base
disputam com mesma especificidade, então o `!important` é necessário para o skin vencer. A remoção
por redundância (que rendeu muito em Lista/Investimentos no desktop) tem **teto baixo no mobile**.

**Conclusão:** atacar o mobile `!important` página-a-página dá pouco retorno e alto atrito
(media queries mistas, sub-views condicionais como Parceladas, modais). O caminho correto para
eliminar o `!important` estrutural é a **causa-raiz #3 — cascade layers** (`@layer base, skin`),
que faz o skin vencer sem `!important`. Recomendado avaliar #3 numa página-POC antes de prosseguir.

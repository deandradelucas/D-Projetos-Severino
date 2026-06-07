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

### POC cascade layers (#3) — jun/2026 — REPROVADA (revertida)
Testei a migração `@layer base, skin` no dashboard.css (base=00-12, skin=13-38 via
`@import ... layer(...)`) + remoção de TODOS os `!important` dos partials. Medido em
/configuracoes (conta real, freeze, baseline 155 elem).

**Resultado: quebrou tudo — 155/155 elementos mudaram** (claro+escuro). Causa: ao layerizar
só o dashboard.css, o CSS **unlayered** restante (Tailwind, .css de componentes, theme-mirrors)
passa a vencer o dashboard layerizado (regra normal unlayered > regra normal layered). 100% revertido
via `git checkout` (produção intocada).

**Conclusão:** `@layer` só funciona se TODA a cascata (Tailwind + componentes + theme-mirrors +
partials) for migrada coerentemente — projeto grande e de alto risco, desproporcional ao benefício
(débito de manutenibilidade, não funcional). **Recomendação: NÃO migrar para @layer.** O `!important`
restante (~5.900: mobile estrutural + base + load-bearing desktop) é majoritariamente necessário pela
arquitetura skin-sobre-base atual. Os ganhos seguros (~1.560 no desktop) já foram capturados.

### Reversão do veredito "mobile é estrutural" (jun/2026) — ferramenta block-aware
O achado "mobile quase 100% load-bearing" era **artefato do método linha-a-linha**, não da realidade.
A ferramenta **`scripts/strip-important-keep.mjs`** (block-aware, comment-safe, @media-aware) preserva
apenas blocos cujo seletor contém uma classe load-bearing (descoberta por strip-total + fingerprint) e
remove o resto. Resultado no mobile:

| Partial mobile | Antes | Depois | Δ | Verificação |
|---|---|---|---|---|
| `26-mobile-transacoes-fix` | 503 | 251 | −50% | diff=0 claro+escuro, root `.page-transacoes` |
| `33-pagamento-mobile` | 123 | 0 | −100% | strip-total deu diff=0 (tudo redundante) |
| `23-mobile-pages` (agenda+config) | 807 | 532 | −34% | diff=0 (agenda + config, dual-tema) |
| `23-mobile-pages` (invest+lista+rel+pag) | 532 | 373 | −30% | diff=0 dual-tema nas 4 páginas; estados ocultos (modal/comparador invest, agenda-modal) preservados via KEEP |

**Método por página no 23 (page-scoped por seletor):** baseline dual-tema (alternando `body.dataset.theme`
no mesmo documento, sem nav) → strip-total temporário → diff por página revela classes load-bearing
(invest: `page-investimentos-resumo`+`ref-panel`; relatórios: `relatorios-charts*`+`*chart-panel/card`;
pagamento: `page-pagamento-planos/valor`+`pagamento-checkout-panel`+`*detalhes/historico`; lista: **nenhuma**,
100% redundante) → restaura pristine → roda `strip-important-keep` com KEEP completo (load-bearing + estados
ocultos + seções agenda/config inteiras) → verifica diff=0 dual-tema em todas. Estados ocultos (modais,
comparador) **sempre no KEEP** porque o fingerprint não os mede.

**Conclusão revisada:** o `!important` mobile **não** é majoritariamente estrutural — é em boa parte
redundante por especificidade, igual ao desktop. O teto baixo anterior era limitação do método de bisecção
por linha. Com a ferramenta block-aware, mobile rende tanto quanto desktop.

### Round cross-cutting (jun/2026) — 22 entregue, 05 deferido
| Partial | Antes | Depois | Δ | Status |
|---|---|---|---|---|
| `22-mobile-foundation` | 249 | 207 | −42 (−17%) | ✅ deployado — diff=0 shell (`.app-layout-shell`, 384 els) + drawer aberto (`.sidebar.open`), dual-tema. Maioria load-bearing (strip-total muda 135–143/384): o shell mobile disputa especificidade com a base, então o `!important` é necessário. Removido só o redundante (mobile-bottom-nav, containers de alto nível). |
| `05-dark-shell-agenda-mobile-hubs` | 574 | 494 | −80 | ✅ **agenda capturada** (deployado `395e1f2`) — ferramenta evoluída |

**Por que 05 foi deferido (não é desistência — é a ferramenta errada para este arquivo):**
- Sonda revelou redundância **concentrada na agenda** (strip-total muda só **15 claro / 4 escuro** de 227
  elementos em `/agenda` mobile → ~93% redundante) e shell de dashboard **majoritariamente load-bearing**
  (107/96 de 384 mudam: ref-kpi/ref-panel/ref-tx/hub chrome).
- **Bloqueio técnico:** as regras de agenda em 05 são scoped como `.dashboard-container.agenda-page …` —
  **compartilham os tokens de container** (`dashboard-container`, `ref-dashboard`, `app-horizon-shell`) com o
  shell load-bearing do dashboard. A ferramenta block-aware decide por "preservar se o prelúdio contém token X";
  não há como isolar "agenda redundante" sem colidir com tokens que precisam ser preservados no dashboard.
- **Escopo:** 05 cobre 7 páginas (dashboard, agenda, relatórios, configurações, pagamento, transações,
  admin-usuários) em **desktop E mobile** (145 `!important` em `min-width`, 429 em `max-width`) + modal de
  agenda (`agenda-modal-backdrop`, estado oculto) + chat `horizon-*` (conteúdo volátil que inflou o diff com
  falsos positivos). A matriz de verificação segura (≈7 páginas × 2 viewports × 2 temas + modal) é grande e
  propensa a erro no ambiente atual (HMR com full-reload + logout intermitente).
- **Recomendação:** capturar a redundância da agenda em 05 exige (a) um seletor de KEEP por **regex de prelúdio**
  (ex.: contém `agenda-` mas não `ref-kpi`/`ref-panel`/`ref-tx`), evoluindo a ferramenta, **ou** (b) um run
  headless multi-viewport scriptado (CI/Linux) que automatize a matriz. Tarefa dedicada, fora deste round.

### RESOLVIDO (jun/2026) — ferramenta evoluída destravou a agenda do 05
Implementei a recomendação (a): `strip-important-keep.mjs` ganhou **`--only=<regex>`** (limita o strip a blocos
cujo prelúdio casa o padrão; resto intacto) e **KEEP por regex** (`re:<padrão>`). Isso isola a seção de agenda
sem colidir com os tokens de container do shell load-bearing.

- **Comando:** `--only='(?<!:not\()\.agenda-page'` (casa `.agenda-page` **fora** de `:not()`, evitando os blocos
  `:not(.agenda-page)` que são de outras páginas) + KEEP dos load-bearing de agenda (hero-row/actions, mobile-menu-btn,
  icon-wrap, ref-dashboard-scroll), do container fixo (`re:agenda-page\.ref-dashboard\.app-horizon-shell\s*$`),
  do modal (`agenda-modal` cobre backdrop), e de 3 seletores de **elemento/estado** que o fingerprint não pega por
  não terem classe própria (`re:agenda-list-panel--daily h2`, `re:agenda-day-item h3`, `agenda-calendar-day--selected`).
- **Resultado:** 574 → 494 (**−80**), `diff=0` em **agenda mobile + agenda desktop + modal de agenda**, claro+escuro.
  Guard de **dashboard mobile intacto** (os únicos diffs foram do widget de chat `horizon-*`, conteúdo volátil — o
  `--only=agenda` comprovadamente não tocou o shell). Deployado `395e1f2`.
- **Aprendizado:** seletores de **elemento** (`h2`, `h3`) e de **estado** dentro da seção exigem KEEP por regex —
  o fingerprint só sinaliza por classe do elemento, e elementos sem classe (um `h2`) passam batido. O `diff=0`
  detalhado (com delta por prop) pegou o `h2 #050505→#111827` e fechou o furo.
- **Restante de 05 (~494) é load-bearing** (shell de dashboard) ou seções de página não-isoladas — sem ROI seguro.

### Round modais mobile (jun/2026) — resultado MISTO (não é categoria uniforme)
Partials de modal mobile: `30-investimentos-modal` (178), `32-lista-modal` (161), `29-comparador` (129),
`24-bottom-sheets` (32), `25-audit-fixes` (67). Testados um a um com a ferramenta evoluída (KEEP de estados ocultos):

| Modal | Antes | Depois | Δ | Resultado |
|---|---|---|---|---|
| `29-comparador` | 129 | 52 | **−77** | ✅ form visível 100% redundante; estado de resultado (`__resultado/__res-row/__melhor-badge/__slot--melhor/__liq-value/__cdi-aviso`, **não renderizado** até preencher) preservado via KEEP. diff=0 claro+escuro. Deployado. |
| `32-lista-modal` | 161 | 74 | **−87** | ✅ form "nova lista" redundante (exceto `tipo-hint` dark); estados ocultos (`autocomplete/modal-resumo/modal-select/modal-total-display/modal-row/modal-subhint/modal-input--datetime`) preservados. diff=0 claro+escuro. |
| `30-investimentos-modal` | 178 | 178 | 0 | ⏸ load-bearing no **escuro** (strip-total muda 41/66). KEEP redundante rendia só −7 → restaurado intacto. |
| `25-audit-fixes` | 67 | 67 | 0 | ⏸ **override por design** ("carregado por último → vence empates de especificidade"). Cada regra existe para vencer 22-24/05 → load-bearing. |
| `24-bottom-sheets` | 32 | 32 | 0 | ⏸ comportamento de sheet (transform/border-radius que faz o modal deslizar de baixo, sobrescrevendo o modal centralizado base) → load-bearing. |

- **Lição:** modal **não** é categoria uniforme. Modais de **conteúdo** (comparador, criar-lista) têm chrome visível
  redundante → reduzem bem. Modais de **skin escuro** (30) e arquivos de **override por design** (24/25) são
  load-bearing. O fingerprint detalhado + KEEP de estados ocultos (verificados por presença no DOM) é o que torna
  seguro reduzir os de conteúdo sem quebrar os sub-estados (resultado do comparador, autocomplete da lista).

## Encerramento da campanha `!important` (jun/2026)
Ganhos seguros capturados e deployados. O `!important` restante é majoritariamente **necessário pela
arquitetura skin-sobre-base**: shell mobile (22, estrutural), modais (skin escuro sobre base), e o que sobra
em 05 (mistura desktop+mobile não-isolável pela ferramenta atual). Próximos ganhos exigem **evoluir a
ferramenta** (KEEP por regex de prelúdio) ou **automação headless multi-viewport** — não mais edição manual.

| Round | Entregue |
|---|---|
| Skins desktop (rounds anteriores) | ~1.560 removidos (8 páginas) |
| 23-mobile-pages | 807 → 373 (−434) |
| 26-mobile-transacoes | 503 → 251 (−252) |
| 33-pagamento-mobile | 123 → 0 (−123) |
| 18-agenda-desktop | 714 → 449 (−265) |
| 22-mobile-foundation | 249 → 207 (−42) |
| **Deferidos (load-bearing/não-isolável):** | 05-dark-shell (574), modais 30/32/29/24/25 (~567) |

# Plano de Reconstrução da Arquitetura CSS — Severino (release/1.0.4)

> Autorizado pelo CEO em 08-jun-2026: "pode apagar todo CSS e remontar; 1.0.4 não está em produção."
> Decisões do CEO: **Big-bang · Pixel-fiel · BEM + Cascade Layers**.
> Skills de apoio: `ui-ux-pro-max`, `frontend-design`.
> Continuação de: `docs/arquitetura-css-layers.md`, `docs/v1.0.4-css-migration-status.md`, `docs/tokenizacao-css-plan.md`.

---

## 1. Diagnóstico atual (medido em 08-jun, branch release/1.0.4)

| Métrica | Valor real | Observação |
|---|---|---|
| Linhas de CSS | **48.399** em 60 arquivos | camada geológica de redesigns |
| Partials no `dashboard.css` | **52 @imports** numa única `@layer app` | cascata por ORDEM-de-import |
| `!important` | **32** (não 5.985) | catraca + tokenização já venceram a guerra |
| Arquivos dark dedicados | 3 (`mirror` 2418 + `polish` 260 + `fullblack` 785 = ~3.463) | candidatos a deleção total |
| Cores hardcoded nos partials | ~2.949 | meta: ler `var(--token)` |
| Tokens (`00-tokens-base` + `@theme` no index) | **bem estruturado** | 🟢 fundação a preservar |
| Classes no JSX | BEM semântico (`dashboard-hub__btn--primary`) | 🟢 contrato limpo, não precisa mudar |
| Tailwind v4 | instalado, usado só como escape hatch | manter só utilities pontuais |

**A doença NÃO é mais `!important`** (só 32). A doença é:
1. **Organização** — 52 partials com nomes históricos (`16-modal-nova-tx`, `16-investimentos` duplicados; `25-mobile-audit-fixes`; `26-mobile-transacoes-fix`), redesigns empilhados em vez de consolidados.
2. **Duplicação** — o mesmo componente é estilizado em base (00-12) + skin desktop (13-21) + skin mobile (22-34) + dark (mirror/polish/fullblack). 4 lugares para 1 botão.
3. **Tokenização incompleta** — ~2.949 cores hardcoded impedem deletar os 3 dark files (dark hoje é override de regra, não swap de token).

**Causa raiz histórica** (provada em `v1.0.4-css-migration-status.md`): arquitetura "skin-sobre-base", autoridade codificada por-REGRA. Solução já recomendada pelo conselho: **refatoração na fonte** = `arquivo = autoridade`. Este plano executa isso.

---

## 2. Arquitetura-alvo

### 2.1 Princípios (boas práticas)
1. **Single source of truth**: cor/raio/sombra/espaço só via `var(--token)`. Zero hex hardcoded fora de `tokens/`.
2. **Dark mode = swap de token**, não override de regra. `body[data-theme='dark']` redefine tokens; componentes não sabem que tema existe. → permite **deletar os 3 dark files**.
3. **Um componente, um arquivo, uma autoridade**. Nada de "base + skin + fix" para o mesmo elemento.
4. **Cascade Layers ITCSS** — ordem decide precedência, não especificidade. `!important` proibido (catraca → 0).
5. **Mobile no mesmo arquivo do componente** (media query co-localizada), não em "mobile-fix" separado.
6. **BEM mantido** — o JSX já usa; é o contrato. Sem renomear classes (reduz risco e escopo).

### 2.2 Ordem de layers (em `src/styles/index.css`)
```css
@layer reset, tokens, base, layout, components, pages, utilities;
@import "tailwindcss"; /* mapeado: theme→tokens, preflight→reset, utilities→utilities */
```

| Layer | Conteúdo | Vence | Perde p/ |
|---|---|---|---|
| `reset` | preflight Tailwind + reset global | — | tudo |
| `tokens` | `@theme` + tokens canônicos (light) + `body[data-theme=dark]` | reset | base+ |
| `base` | html/body, tipografia base, scrollbars, safe-area, focus-visible | tokens | layout+ |
| `layout` | shell (`app-horizon-shell`, `main-content`), sidebar, grids | base | components+ |
| `components` | vocabulário reutilizável: botões, cards, modais, forms, badges, tabelas, chips, FAB, close-btn | layout | pages+ |
| `pages` | desvios específicos de página (só o que é único da página) | components | utilities |
| `utilities` | utilities do Tailwind (escape hatch no JSX) | tudo | — |

**Regra de ouro:** página só sobrescreve componente quando há motivo real e único da página. Se 2 páginas precisam do mesmo desvio → vira variante de componente.

### 2.3 Estrutura de arquivos (alvo)
```
src/styles/
  index.css                 ← ÚNICO entry (substitui index.css + dashboard.css)
  tokens/
    _tokens.css             ← porta 00-tokens-base.css (o ativo bom) + @theme
  base/
    _reset.css
    _typography.css
    _globals.css            ← html/body, scrollbar, safe-area, focus-visible
  layout/
    _shell.css
    _sidebar.css
    _grids.css
  components/
    _buttons.css            ← .btn, hub__btn, fab, close-btn (UM lugar, 2 temas)
    _cards.css              ← ref-panel, ref-kpi-card, card-base, glass-card
    _modals.css             ← todos os modais + bottom-sheets
    _forms.css              ← inputs, datepicker, switch, calc inline
    _badges.css
    _tables.css             ← listas/linhas de transação, parceladas
    _chips.css
    _charts.css             ← recharts wrappers, legendas
  pages/
    _dashboard.css  _transacoes.css  _investimentos.css  _relatorios.css
    _agenda.css     _listas.css      _configuracoes.css   _pagamento.css
    _cartoes.css    _metas.css       _bem-vindo.css       _trial.css
  utilities/
    _utilities.css          ← utilities custom + helpers (desktop-only etc.)
```
CSS "solto" hoje (componentes React com `.css` próprio: `DashboardInsightsStrip`, `OnboardingChecklist`, `PwaInstallPrompt`) → migrados para `components/` ou mantidos co-localizados MAS dentro de `@layer components` (sem ficar unlayered vencendo tudo).

---

## 3. Execução — Consolidação in-place verificável (decisão CEO 08-jun)

> **Mecânica escolhida pelo CEO:** consolidação in-place, NÃO árvore-paralela big-bang.
> Motivo: a Fase 0 confirmou a prova do squad (`v1.0.4-css-migration-status.md`) de que
> re-layerizar os arquivos atuais quebra (autoridade é por-regra, não por-arquivo), e que
> um cutover único só é verificável no fim (depurar 48k linhas no escuro se diff≠0).
> Com o fingerprint funcionando, migra-se componente/página por vez, rodando `--check`
> (diff=0) e **commitando a cada passo**. Mesmo destino arquitetural; risco controlado;
> o app nunca quebra. "Big-bang na estrutura, pragmatismo na regra."
>
> **Loop por unidade:** consolidar (juntar as regras espalhadas do componente num só lugar,
> remover duplicação base+skin+mobile+dark, trocar hardcoded→token) → `npm run build` +
> `test:unit` + lint → fingerprint `--check` diff=0 → commit. Se diff≠0, sabe-se exatamente
> qual unidade. Quando a autoridade de um componente vive em um arquivo, o `@layer` semântico
> passa a ser seguro para aquele componente.

> A rede de segurança (Fase 0, fingerprint) é o que torna "pixel-fiel" verificável a cada passo.

### Fase 0 — Rede de segurança e captura da referência (ANTES de apagar)
- [ ] Confirmar árvore git limpa; trabalhar em `release/1.0.4` (já fora de produção).
- [ ] **Capturar referência visual** de cada rota × {light, dark} × {desktop 1440, mobile 375} × estados-chave (modais ABERTOS, hover/focus, erro de form, empty state, listas com dados). Salvar em `docs/design/reference/`.
- [ ] **Extrair o DNA do design**: valores computados dos componentes-chave (cores, raios, sombras, espaçamentos, tipografia) → `docs/design/spec/` por componente. Esta é a spec pixel-fiel.
- [ ] Provar que o harness de fingerprint (`docs/css-fingerprint-harness.md`) detecta uma quebra plantada.

### Fase 1 — Nova fundação (paralela, sem ligar ainda)
- [ ] Criar `src/styles/` com a ordem de layers + `tokens/_tokens.css` (porta de `00-tokens-base` + `@theme`) + `base/` (reset, tipografia, globals).
- [ ] Não trocar imports do app ainda — fundação dorme até a Fase 3.

### Fase 2 — Biblioteca de componentes (vocabulário compartilhado)
Cada arquivo consolida o componente num só lugar, 2 temas via token, zero `!important`, construído contra a referência:
- [ ] `_buttons.css` (btn, hub__btn primary/secondary, icon-btn, fab, close-btn)
- [ ] `_cards.css` · `_modals.css` · `_forms.css` · `_badges.css` · `_tables.css` · `_chips.css` · `_charts.css`
- [ ] Verificar cada componente isolado contra screenshot de referência (2 temas).

### Fase 3 — Reconstrução página-a-página
Ordem por risco/uso (mais usada primeiro, para validar o vocabulário cedo):
1. [ ] Dashboard (home)  2. [ ] Transações  3. [ ] Investimentos  4. [ ] Relatórios
5. [ ] Agenda  6. [ ] Listas  7. [ ] Configurações  8. [ ] Pagamento
9. [ ] Cartões  10. [ ] Metas  11. [ ] Bem-vindo/Assinatura  12. [ ] Trial
- Para cada página: escrever `pages/_X.css` usando SÓ componentes + tokens → verificar contra referência (diff visual light+dark, desktop+mobile) → `build && lint && test:unit` → **commit por página**.

### Fase 4 — Cutover e deleção
- [ ] Trocar o entry: `main.jsx`/páginas passam a importar `src/styles/index.css`; remover imports de `dashboard.css` e os `.css` soltos.
- [ ] **Deletar** os 60 arquivos antigos + 3 dark files (~48k linhas → alvo ~6-9k).
- [ ] Regressão completa: toda rota, 2 temas, modais, mobile, PWA.

### Fase 5 — Guard-rails (impedir a doença voltar)
- [ ] Catraca `!important` → baseline **0** (`scripts/check-important-budget.mjs --update`).
- [ ] **Stylelint** com regras: BEM, `declaration-no-important`, cores só via token (`color-no-hex` exceto em `tokens/`), `@layer` obrigatório.
- [ ] Atualizar `docs/design/css-conventions.md` + `AGENTS.md` (regra: novo estilo → componente em `@layer components`, nunca novo partial-fix).
- [ ] Rodar `npm run audit:dashboard-css` (CSS morto) na nova base.

---

## 4. Critérios de sucesso (Definition of Done) — RECALIBRADO 08-jun

> **Recalibração (decisão CEO):** "arquitetura primeiro, pixel-fiel travado". A Fase 1
> provou que os 3 dark files são **~90% design dark genuíno** (gradientes/sombras/surfaces
> bespoke), NÃO código morto — pixel-fiel impede deletá-los. Eles são **eliminados por
> co-localização** (dobrar cada regra dark no arquivo do componente), o que **realoca**
> linhas em vez de apagá-las. Logo a meta −80% era irreal. Objetivo real = **qualidade
> arquitetural a diff=0**, com redução de linhas modesta (~30-45%).

- **Visual: pixel-fiel** à referência da Fase 0 (fingerprint diff=0 em todas as cenas) — **inegociável**.
- `!important`: 32 → **0**.
- **file = authority**: cada componente com suas regras (light+dark) num só lugar; fim da duplicação base/skin/mobile/dark.
- **3 dark files eliminados por co-localização** (regras dobradas nos componentes; dark = `body[data-theme=dark]` co-locado ou swap de token).
- `@layer` semântico limpo (reset/tokens/base/layout/components/pages/utilities) — viável por componente após consolidar sua autoridade.
- Cores: gold/semânticas invariantes via token; bespoke (paletas de feature, sombras) permanecem literais documentadas.
- Linhas de CSS: redução **~30-45%** (consequência, não meta).
- `npm run ci` verde; zero regressão funcional.

### Mecânica convergente (descoberta na Fase 1)
"Deletar dark files", "dedup de partials" e "consolidar componentes" são **o mesmo trabalho**:
consolidação **por-componente** que puxa a regra dark junto. Loop por componente:
juntar regras espalhadas (base+skin+mobile+dark) num arquivo → `--check` diff=0 → commit.

### ⚠️ Descoberta-chave (close-btn, 08-jun): autoridade é MIX POR-PROPRIEDADE
Duas tentativas de consolidar o close-btn quebraram diff=0 e revelaram o cerne da dívida:
1. **Unlayered vence layered:** `metas.css`/`cartoes.css` (importados direto pelo JSX) são
   *unlayered* → vencem QUALQUER regra em `@layer app` (os 52 partials, incl. 35-close-btn),
   independente de especificidade.
2. **Mas a aparência final é um mix por-propriedade:** o arquivo unlayered vence as props que
   *ele* seta; o partial layered ainda fornece as props que o unlayered *não* seta. Nenhum é
   dono completo do componente.
3. **Logo "remover a regra redundante" é armadilha** — mesmo parecendo 100% sobrescrita, cada
   arquivo contribui um subconjunto distinto de propriedades.
4. **Método correto:** unir as props de TODAS as regras contribuintes → escrever no arquivo-alvo
   cada prop com o valor vencedor atual → remover as outras → `--check` diff=0. O harness é o
   oráculo (rodar a cada passo); raciocínio de especificidade não basta.

## 5. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Perder UI refinada no big-bang | Fase 0 captura referência + DNA antes de apagar; verificação por tela |
| Estado quebrado entre fases | Fundação nova dorme até Fase 3; cutover atômico na Fase 4; commit por página |
| Pixel-diff estático perde modais/hover/erro | Harness completo (modais abertos, :hover/:focus forçados, erro de form) — pré-condição C1 |
| CSS solto unlayered vencendo tudo | Folddos em `@layer components` na Fase 2/4 |
| Recharts/line-awesome/fontsource CSS | Mapeados em `vendor`/`base` na ordem certa |
| Regressão funcional silenciosa | `test:unit` + smoke manual dos gestos por página |

## 6. Estimativa
Multi-sessão. Fase 0-2: 1-2 sessões. Fase 3: ~1 página por bloco (12 páginas). Fase 4-5: 1 sessão. Commit atômico por página/componente → reversível a qualquer ponto.

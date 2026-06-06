# Auditoria UI/UX — Severino (06/jun/2026)

Auditoria full-system com a skill **ui-ux-pro-max** (4 agentes paralelos: Finanças core / Organização / Relatórios+Config+Pagamento / Auth+Shell). Régua: touch targets 44px, SVG (não emoji), contraste 4.5:1, focus-visible, prefers-reduced-motion, semantic HTML + ARIA, loading states, hierarquia, responsividade.

> **Listas** foi auditada e corrigida à parte (SVG, hit-area do checkbox, footer horizontal) — ver [[reference-lista-compras-ui]].

## 🔴 Críticos sistêmicos

### 1. Touch targets < 44×44px (WCAG 2.5.5/2.5.8; gap ≥8px)
- Transações: editar/excluir 32px (`partials/02c:2133`), parcela 30px (`partials/07:1495`), limpar busca 22px (`partials/26:63`)
- Cartões: swatch de cor 30px (`cartoes.css:248`), kebab 30px (`cartoes.css:94`), nav fatura 32px (`cartoes.css:300`)
- Metas: kebab 30px (`metas.css:96`)
- **Fix:** padding/`min-44` mantendo o visual (padrão já aplicado na Lista).

### 2. Emoji como ícone de UI (usar SVG Lucide/Heroicons)
- Cartões/Metas: toggle 👨‍👩‍👧/👤, kebab `⋯`, chevrons `‹›`, empty 💳/🎯
- **Metas: seletor de 12 ícones-emoji** (`Metas.jsx:16`) — PERSISTIDO no banco (`meta.icone`); migração para SVG exige resolver chave→SVG e compat com dados antigos.
- Dashboard: 🎉 (`Dashboard.jsx:396`); Relatórios: 📊 (`Relatorios.jsx:722`), setas ▲▼ (`Relatorios.jsx:517/541`)

### 3. Linha de transação inacessível por teclado
- `TransacaoRow.jsx:136` é `<div onClick>` sem `role/tabIndex/onKeyDown`.

### 4. Foco suprimido (`outline:none` sem substituto forte)
- Botão de checkout dark (`partials/02a:431`), select de Config (`partials/10:1122`), inputs de Cartões/Metas sem `:focus-visible` (`cartoes.css:244`, `metas.css:276`).

## 🟠 Altos
- `aria-label` faltando: cards de Investimento editar/aportar/remover (`InvestimentoCard.jsx:723`), "Encerrar" recorrência (`Transacoes.jsx:1047`), "Remover" membro (`Configuracoes.jsx:1113`), "Sair" sidebar (`Sidebar.jsx:290`).
- `aria-current` ausente: Sidebar (NavLink) e `MobileBottomNav.jsx:12`.
- Loading sem skeleton (content-jumping): Cartões (`Cartoes.jsx:498`), Metas (`Metas.jsx:422`).
- Charts: pie sem `aria-label`/tabela alternativa, drill-down só por clique, ticks 10px (`relatorios/RelatoriosCharts.jsx`).
- `prefers-reduced-motion` não cobre: pulse Agenda (`partials/18:352`), `animate-ping` BemVindo, recharts, partials 09/15.
- Focus ring global do desktop dentro de `@media min-width:769` — some no mobile (`partials/13:784`).

## 🟡 Médios
- Contraste <4.5:1 (claro): `--neu-text-lo` #8896a5 (`partials/13:61`), hints auth neutral-400/10px, danger `#dc2626` no dark, `--m-accent-fg` branco-sobre-dourado mobile (~2.9:1).
- Inputs órfãos (sem `<label for>`): edição de nome Config (`Configuracoes.jsx:713`), painel recuperação Login (`Login.jsx:449`).
- z-index sem escala (1…9999 ad-hoc) → risco de modal atrás de modal.
- `useModalA11y` só em 3 de ~10 modais (Agenda/Metas/Pagamento/Investimentos têm lógica própria/incompleta).
- ARIA: `role="alertdialog"` no ConfirmDialog (`ConfirmDialog.jsx:65`), `role="progressbar"` nas barras (Metas `240`, Relatórios `374`), tablist incompleto Cartões (`Cartoes.jsx:223`), `aria-live` na fatura.
- CPF com `autoComplete="off"` (`Pagamento.jsx:783`); `recoveryMsg` sem `role=alert` (`Login.jsx:515`).
- `autoFocus` ausente no email do Login (`Login.jsx:388`).

## 🟢 Pontos fortes
- `<time dateTime>`, `aria-pressed`, skeletons com `aria-busy` (Dashboard/Investimentos/Pagamento), optimistic UI com rollback, lazy+Suspense nos charts, focus-trap na sidebar mobile, `autocomplete` + força de senha na auth, tokens de cor centralizados, Agenda 100% SVG + ARIA exemplar.

## Plano de implementação (ordem de ROI)
1. Touch targets (CSS, padrão hit-area) — Cartões/Metas/Transações.
2. Emoji→SVG chrome — Cartões/Metas/Dashboard/Relatórios (reusar ícones da Lista).
3. focus-visible padronizado (remover `outline:none` + ring de marca).
4. Keyboard na linha de transação + `aria-label`/`aria-current` faltantes.

**Deferidos (maior escopo/risco):** seletor de ícones das Metas (migração de dados), escala de z-index, rollout do `useModalA11y` em todos os modais, alternativa em tabela dos charts, ajustes finos de contraste de token.

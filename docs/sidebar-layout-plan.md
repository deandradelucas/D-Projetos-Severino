# Plano de Melhorias — Menu Lateral (Sidebar)

> Foco: **layout e arquitetura visual**. Não cobre lógica de rotas/permissões.
> Base: `src/components/Sidebar.jsx`, `src/lib/navItems.jsx`, `src/pages/dashboard/partials/14-sidebar-neumorphic-desktop.css` (desktop ≥769px) e `01-layout-sidebar-intro.css` (estrutura/largura).
> Data: 2026-06-05

---

## 1. Diagnóstico do estado atual

| Aspecto | Hoje |
|---------|------|
| Largura | `260px` fixa (desktop), drawer no mobile |
| Estética | Neumórfica "clay" (dark obsidian / light branco), bem resolvida |
| Brand | Mark **90×90px** + wordmark "Severino" 1.625rem |
| Itens principais | 8 (Dashboard, Transações, Cartões, Investimentos, Metas, Relatórios, Agenda, Listas) |
| Item "Pagamento" | Hardcoded inline no JSX, **solto** entre a nav e a seção "Conta" (sem label de seção) |
| Seções | "Conta" (Ajustes) e "Administração" (só admin) |
| Rodapé | Selo de versão (`<span style>` inline) + botão "Sair" |
| Densidade | `gap: 4px` entre itens, padding `11px 14px` (~44px de altura → toque OK) |
| Animação | Stagger reveal por item no load |

### Pontos fracos de layout identificados

1. **Lista plana e longa.** 8 itens principais + Pagamento + Conta + Admin viram uma coluna comprida. Com admin visível, a `.nav-menu` **rola** (`overflow-y:auto`) — o usuário perde a visão geral.
2. **"Pagamento" órfão.** Aparece sem agrupamento, quebrando o ritmo entre a nav principal e a seção "Conta". Conceitualmente é "Conta/Assinatura".
3. **Sem hierarquia funcional.** Tudo no mesmo peso visual — não há separação entre "Finanças" (núcleo) e "Organização" (Agenda/Listas).
4. **Brand ocupa muito espaço vertical.** Mark de 90px + margem 28px come ~140px do topo antes do 1º item.
5. **Sem identidade de conta.** Não há avatar/nome/plano do usuário — o rodapé é só versão + sair. Falta âncora de contexto ("quem está logado / qual plano").
6. **Sem modo compacto.** Largura fixa 260px; em telas menores (769–1024px) o painel de conteúdo fica espremido sem opção de colapsar.
7. **Inconsistência de fonte de dados.** "Pagamento" é SVG/markup inline no componente, enquanto os demais vêm de `navItems.jsx`. Dificulta manter espaçamento/ícones uniformes.
8. **Selo de versão com estilo inline.** `style={{...}}` no JSX foge do design system (tokens `--sb-*`).

---

## 2. Oportunidades priorizadas

Legenda de esforço: 🟢 baixo (CSS/markup) · 🟡 médio · 🔴 alto (estrutura/estado)

### P0 — Alto impacto, baixo risco

| # | Melhoria | Esforço | Resultado |
|---|----------|---------|-----------|
| P0.1 | **Reagrupar a IA do menu** em seções nomeadas | 🟢 | Hierarquia clara, menos "parede de itens" |
| P0.2 | **Mover "Pagamento" para a seção Conta** e migrar para `navItems.jsx` | 🟢 | Remove o item órfão, padroniza |
| P0.3 | **Reduzir o brand** (mark ~56–64px) e compactar o topo | 🟢 | Recupera ~50–70px verticais |
| P0.4 | **Selo de versão via tokens** (remover `style` inline) | 🟢 | Consistência com o design system |

### P1 — Alto impacto, esforço médio

| # | Melhoria | Esforço | Resultado |
|---|----------|---------|-----------|
| P1.1 | **Bloco de conta no rodapé** (avatar + nome + plano) | 🟡 | Contexto de quem está logado + atalho a Ajustes |
| P1.2 | **Fade de scroll** no topo/base da `.nav-menu` quando há overflow | 🟢 | Indica que há mais itens ao rolar |
| P1.3 | **Atalho de tema** (claro/escuro) no rodapé da sidebar | 🟡 | Troca rápida sem ir a Ajustes |

### P2 — Estrutural (maior esforço)

| # | Melhoria | Esforço | Resultado |
|---|----------|---------|-----------|
| P2.1 | **Modo compacto / rail colapsável** (72px, só ícones + tooltip) | 🔴 | Mais área de conteúdo; já há resquício `min(72px,12vw)` no CSS |
| P2.2 | **Persistir preferência** de colapsado (localStorage) | 🟡 | Continuidade entre sessões |
| P2.3 | **Densidade adaptativa** por altura de viewport | 🟡 | Evita scroll em telas baixas |

---

## 3. Proposta de Arquitetura de Informação (P0.1)

Reorganizar de uma lista plana para **4 grupos** com labels de seção (o padrão `.nav-section-label` já existe):

```
─ PRINCIPAL
   Dashboard

─ FINANÇAS
   Transações
   Cartões
   Investimentos
   Metas
   Relatórios

─ ORGANIZAÇÃO
   Agenda
   Listas

─ CONTA
   Pagamento        ← migrado para cá (hoje órfão)
   Ajustes

─ ADMINISTRAÇÃO     (só admin — já existe)
   Logs Usuários
   Auditoria
   Logs de Pagamentos
   Marketing
```

**Por quê:** agrupar por função reduz a carga cognitiva, dá ritmo vertical (os dividers já têm `::after` com gradiente) e deixa claro o que é "núcleo financeiro" vs "ferramentas de organização" vs "conta".

> Decisão a validar com o CEO: manter "Dashboard" sozinho em PRINCIPAL ou fundir com FINANÇAS. Recomendação: manter separado (é a home).

---

## 4. Detalhe das melhorias de topo (P0.3) e rodapé (P1.1)

### Topo compacto
- Mark de 90→**60px**, wordmark mantém 1.4–1.5rem, alinhados na horizontal.
- `margin-bottom` do brand 28→**18px**.
- Ganho: ~60px verticais → menos scroll com admin ativo.

### Rodapé com identidade de conta
```
┌─────────────────────────────┐
│ (avatar)  João Andrade       │   ← clicável → /configuracoes
│           Plano mensal ✓     │
├─────────────────────────────┤
│  ☾ Tema      ⎋ Sair          │   ← atalhos lado a lado
└─────────────────────────────┘
   v1.0.3
```
- Substitui o "Sair" solto por um **footer-card** coeso.
- Reusa dados já disponíveis (nome do usuário, situação da assinatura) — sem nova chamada de API.

---

## 5. Modo compacto / rail (P2.1) — esboço

- Botão de colapso no topo (ou borda direita).
- Estado colapsado: largura `72px`, esconde `.nav-item__label` e `.nav-section-label`, centraliza `.icon-wrap`, mostra **tooltip** no hover (o `title` já existe em vários itens).
- Transição suave de `width` (240ms, `--sb-ease`).
- Persistir em `localStorage` (`sidebar_collapsed_v1`).
- Empurra o `.app-routes-grow` (mais área de conteúdo).
- **Nota:** já existe `width: min(72px, 12vw)` em `01-layout-sidebar-intro.css` (linha ~57) — investigar se é um rail parcial pré-existente antes de implementar.

---

## 6. Sequência de execução sugerida

1. **Sprint 1 (quick wins, 🟢):** P0.1 + P0.2 + P0.3 + P0.4 — só markup/CSS, sem novo estado. Entrega visível imediata.
2. **Sprint 2 (🟡):** P1.1 (footer de conta) + P1.2 (fade scroll) + P1.3 (tema).
3. **Sprint 3 (🔴):** P2.1 rail colapsável + P2.2 persistência + P2.3 densidade adaptativa.

> Cada sprint é independente e deployável. Mobile (drawer) herda P0.1/P0.2 automaticamente; P2.1 (rail) é desktop-only.

---

## 7. Riscos e cuidados

- **Mobile drawer** usa o mesmo componente — validar que o reagrupamento (P0.1) não quebra o drawer nem o `MobileBottomNav` (que já esconde vários itens via `mobileHide`).
- **Focus trap / acessibilidade** já implementados no `Sidebar.jsx` — preservar ao mexer na estrutura.
- **Tokens `--sb-*`** definidos só dentro de `@media (min-width: 769px)` no partial 14 — qualquer novo elemento (footer-card, rail) precisa de cobertura dark **e** light.
- **`stagger reveal`** usa `:nth-child` — ao inserir labels de seção, revisar os delays para não "pular" itens.

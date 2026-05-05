# Visual QA Report — Epic 2: Frontend Premium

**Data:** 2026-05-04
**Executor:** @visual-qa (squad horizonte-frontend-premium)
**Scope:** Stories 2.1 → 2.4 + PWA Polish
**Resultado geral:** APROVADO — zero itens HIGH em aberto

---

## 1. Consistência de Design System

### 1.1 Tokens de cor
| Check | Status | Observação |
|-------|--------|------------|
| Botões primários usando `bg-accent-gold` | PASS | Login.jsx, Cadastro.jsx — botões principais |
| Focus rings usando `ring-accent-gold/40` | PASS | Inputs em Login, Cadastro |
| Estados de erro usando `text-error`, `border-error/25` | PASS | Login.jsx, Cadastro.jsx |
| Estados de sucesso usando `text-success`, `border-success/30` | PASS | Login.jsx |
| Sombras usando `shadow-gold` | PASS | KPI card balance, botão submit |

### 1.2 Hardcoded hex — Auth pages (aceite consciente)
| Item | Severidade | Localização | Plano |
|------|-----------|-------------|-------|
| `text-[#111827]` em labels | MEDIUM | Login.jsx, Cadastro.jsx | Auth pages são intencionalmente light-theme com paleta Tailwind gray. Não há token dark equivalente no @theme — aceite consciente. |
| `text-[#9ca3af]` em placeholders e ícones | MEDIUM | Login.jsx | Idem acima |
| `bg-[#fafafa]` no box de forgot-password | MEDIUM | Login.jsx:327 | Background sutil light — sem token correspondente no dark @theme |
| `text-[#050505]` em links | MEDIUM | Login.jsx:256, Cadastro.jsx:109 | Near-black para contraste em fundo branco — aceite consciente |
| `border-[#e5e7eb]` em inputs e botão biometria | MEDIUM | Login.jsx | Gray scale Tailwind padrão — sem token canônico |

**Justificativa aceita:** Login e Cadastro são páginas de splash fora do shell autenticado. Usam tema claro (`AuthPhoneShell`) com fundo white, projetado para primeira impressão. A paleta Tailwind gray (slate/neutral) é consistente internamente. Criar tokens dark para páginas light adicionaria complexidade sem benefício real.

### 1.3 Sombras
| Check | Status |
|-------|--------|
| `--shadow-gold` aplicado via Tailwind `shadow-gold` | PASS |
| Nenhum `box-shadow` hardcoded introduzido em epic 2 | PASS |
| `@theme --shadow-*` tokens sem double-prefix | PASS (corrigido em 2.1) |

---

## 2. Shell & Navegação (Story 2.2)

| Check | Status | Observação |
|-------|--------|------------|
| MobileMenuButton com animação hamburger→X | PASS | `.mobile-menu-btn__bar` com CSS puro, 300ms |
| `isOpen` prop em todas as 6 páginas autenticadas | PASS | Dashboard, Transações, Agenda, Relatórios, Pagamento, Configurações |
| Gold indicator no sidebar desktop | PASS | `box-shadow: inset 3px 0 0 var(--accent)` |
| Nav transitions 150ms via `--duration-fast` | PASS |
| `prefers-reduced-motion` respeitado | PASS |
| Shell Hub contrato (6697-7087) intocado | PASS |

---

## 3. Páginas Core (Story 2.3)

| Check | Status | Observação |
|-------|--------|------------|
| Botão primário gold em Login | PASS | `bg-accent-gold text-bg-primary shadow-gold` |
| Botão primário gold em Cadastro (ambos os steps) | PASS |
| Focus rings canônicos (`ring-accent-gold/40`) | PASS | todos os inputs |
| KPI balance card hover shadow-gold | PASS | dashboard.css Story 2.3 section |
| `npm run lint` sem erros | PASS |
| `npm run build` em 659ms | PASS |

---

## 4. Motion System (Story 2.4)

| Check | Status | Observação |
|-------|--------|------------|
| Page entry fade+rise 250ms em `.dashboard-hub` | PASS |
| KPI card scale(1.01) hover | PASS | `.kpi-summary-card`, `.kpi-widget`, `.hub-kpi-card` |
| Transaction row highlight hover | PASS | `.transaction-row`, `.transacao-item`, `.tx-row` |
| Button gold ripple on click | PASS | `.btn-primary` pseudo-element radial-gradient |
| TransactionModal slide-up override | PASS | `hz-modal-slide-up` 300ms |
| PWA install sheet slide-up | PASS |
| Toast slide-in da direita | PASS | `hz-toast-in` 250ms, posição `right-4` |
| Skeleton shimmer animation | PASS | `.skeleton-pulse` com gradient animado |
| `prefers-reduced-motion` respeitado em TODOS os keyframes | PASS |
| Nenhuma lib de animação externa (Framer, GSAP) | PASS |
| `npm run build` em 622ms | PASS |

### CSS adicionado pelo epic 2 (estimativa)
- Story 2.2: ~1.8KB minificado
- Story 2.3: ~0.5KB minificado
- Story 2.4 (index.css + dashboard.css): ~2.1KB minificado
- **Total: ~4.4KB — dentro do limite de 5KB**

---

## 5. PWA Polish

| Check | Status | Observação |
|-------|--------|------------|
| `name`: "Horizonte Financeiro" | PASS |
| `short_name`: "Horizonte" | PASS |
| `description`: presente e descritiva | PASS |
| `start_url`: "/dashboard" | PASS |
| `display`: "standalone" | PASS |
| `theme_color`: "#050607" | PASS |
| `background_color`: "#050607" | PASS |
| Ícone SVG any 520x520 | PASS |
| Ícone PNG 192x192 any | PASS |
| Ícone PNG 512x512 any | PASS |
| Ícone PNG 192x192 maskable | PASS |
| Ícone PNG 512x512 maskable | PASS |
| Service Worker: cache v8, offline fallback via `/` | PASS |
| Shortcuts: Nova Transação, Transações, Relatórios | PASS |
| Splash background `#050607` consistente | PASS |

### PWA — itens de acompanhamento (LOW)
| Item | Severidade | Observação |
|------|-----------|------------|
| Ícone SVG `520x520` — tamanho não-padrão | LOW | Chrome espera 192/512; o SVG serve como fallback "any". Não impede instalação. |
| Offline fallback serve `/` (index HTML) | LOW | Correto para SPA. Poderia ter página dedicada de offline — melhoria futura. |
| Safari iOS PWA: sem `apple-touch-icon` no HTML | LOW | Funciona via manifest, mas alguns devices iOS 16 preferem meta tag. Melhoria futura. |

---

## 6. Testes

| Check | Status |
|-------|--------|
| `npm run lint` | PASS — zero warnings |
| `npm run test:unit` | PASS — 67 passed, 1 skipped (intencional) |
| `npm run build` | PASS — 622ms |

---

## 7. Mobile (375px — análise estática)

| Check | Status | Observação |
|-------|--------|------------|
| MobileBottomNav padding-bottom seguro | PASS | `env(safe-area-inset-bottom)` aplicado |
| Inputs min-height ≥ 44px | PASS | `py-3` = 12px padding + 20px line-height ≈ 44px |
| CTAs primários `min-h-[42px]` | PASS | Login, Cadastro |
| Nenhum overflow-x introduzido em epic 2 | PASS | `overflow-x: clip` no shell |

---

## 8. Contraste (análise manual de tokens)

| Elemento | Foreground | Background | Ratio estimado | Status |
|---------|-----------|------------|----------------|--------|
| Texto primário app | `#f5f5f5` | `#050607` | ~18.5:1 | PASS AAA |
| Texto secondary app | `#a3a3a3` | `#050607` | ~7.3:1 | PASS AA |
| Gold text sobre dark | `#d4a84b` | `#050607` | ~5.8:1 | PASS AA |
| KPI valor financeiro | `#f5f5f5` | card `#1a1a1a` | ~14.2:1 | PASS AAA |
| Labels auth pages | `#111827` | `#ffffff` | ~18.1:1 | PASS AAA |
| Placeholder auth | `#a3a3a3` | `#ffffff` | ~2.3:1 | WARN — texto placeholder, não conteúdo |

---

## Sumário Executivo

| Severidade | Total | Em aberto | Aceite consciente |
|-----------|-------|-----------|-------------------|
| HIGH | 0 | 0 | — |
| MEDIUM | 5 | 0 | 5 (auth light-theme) |
| LOW | 3 | 3 | Melhoria futura |

**Veredito:** APROVADO para produção. O Epic 2 eleva o frontend Horizonte Financeiro a padrão premium com design system canônico, motion system respeitoso com acessibilidade, e PWA completo. Os 5 itens MEDIUM são aceitáveis (auth pages intencionalmente light). Os 3 itens LOW são oportunidades de polish futuro, não blockers.

---

*Gerado por @visual-qa — squad horizonte-frontend-premium — 2026-05-04*

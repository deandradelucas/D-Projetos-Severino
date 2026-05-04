# Design System Audit — Epic 2
> Gerado por @design-system-architect | Story 2.1 | 2026-05-04

## Status: COMPLETO

---

## 1. Tokens existentes em `src/index.css` (@theme)

### ✅ Presentes
| Token | Valor | Observação |
|---|---|---|
| `--color-bg-primary` | `#0a0a0a` | OK |
| `--color-bg-secondary` | `#141414` | OK |
| `--color-bg-card` | `#1a1a1a` | OK |
| `--color-text-primary` | `#f5f5f5` | OK |
| `--color-text-secondary` | `#a3a3a3` | OK |
| `--color-text-muted` | `#737373` | OK |
| `--color-accent-gold` | `#d4a84b` | OK |
| `--color-accent-gold-hover` | `#b8923f` | OK |
| `--color-accent-gold-muted` | `rgba(212,168,75,0.15)` | OK |
| `--color-border` | `#2a2a2a` | OK |
| `--color-success` | `#22c55e` | OK |
| `--color-error` | `#ef4444` | OK |
| `--font-family-sans` | Inter + stack | OK |
| `--shadow-shadow-lg` | `0 25px 50px...` | **BUG: prefixo duplo** |
| `--shadow-shadow-gold` | `0 0 30px...` | **BUG: prefixo duplo** |

### ❌ Ausentes (adicionados nesta story)
| Categoria | Tokens |
|---|---|
| Cor base | `--color-bg-base` (#050607) |
| Cor utilitária | `--color-warning`, `--color-info` |
| Tipografia — size | xs, sm, base, lg, xl, 2xl, 3xl, 4xl |
| Tipografia — weight | normal, medium, semibold, bold, extrabold, black |
| Tipografia — line-height | tight, snug, normal, relaxed |
| Border radius | sm, md, lg, xl, 2xl, full |
| Sombras | sm, md (+ correção do bug lg/gold) |
| Motion — duration | fast (150ms), base (200ms), slow (300ms), slower (500ms), count (1s) |
| Motion — easing | out, in-out, decelerate |

---

## 2. Problemas encontrados

### ALTA severidade

| ID | Arquivo | Problema |
|---|---|---|
| A1 | `src/index.css:16-17` | `--shadow-shadow-lg` e `--shadow-shadow-gold` têm prefixo duplicado — geram classes Tailwind com nome errado |
| A2 | `src/pages/Cadastro.jsx` | 20+ hardcoded hex/tailwind-arbitrary em página de produto (light theme) |
| A3 | `src/pages/Login.jsx` | Hardcoded `text-[#050505]`, `text-[#111827]` em vez de tokens |

### MÉDIA severidade

| ID | Arquivo | Problema |
|---|---|---|
| M1 | `src/pages/dashboard.css` | Sistema paralelo de CSS custom props (`:root` com `--bg-primary`, `--accent` etc.) que duplica parcialmente o `@theme` com nomenclatura diferente |
| M2 | `src/index.css` | `#050607` hardcoded diretamente em `html {}` e `body {}` — deveria usar `--color-bg-base` |
| M3 | Geral | Ausência de escala de border-radius canônica — cada componente usa `rounded-{X}` com valores ad hoc |

### BAIXA severidade

| ID | Arquivo | Problema |
|---|---|---|
| B1 | `src/pages/AdminUsuarios.jsx` | Hardcoded hex em status badges — fora do escopo do epic 2 (admin out of scope) |
| B2 | `src/pages/dashboard.css` | `--transacoes-balance-pos: #6366f1` hardcoded em `:root` (light) vs `#3b82f6` em dark |

---

## 3. Tokens adicionados (Story 2.1)

Todos em `src/index.css` dentro do bloco `@theme {}`.

### Correções

```css
/* Antes (bug): */
--shadow-shadow-lg
--shadow-shadow-gold

/* Depois (correto): */
--shadow-lg
--shadow-gold
```

### Novos tokens

```css
/* Base background */
--color-bg-base: #050607

/* Cores utilitárias */
--color-warning: #f59e0b
--color-info: #3b82f6

/* Tipografia — tamanhos */
--font-size-xs: 0.75rem    /* 12px */
--font-size-sm: 0.875rem   /* 14px */
--font-size-base: 1rem     /* 16px */
--font-size-lg: 1.125rem   /* 18px */
--font-size-xl: 1.25rem    /* 20px */
--font-size-2xl: 1.5rem    /* 24px */
--font-size-3xl: 1.875rem  /* 30px */
--font-size-4xl: 2.25rem   /* 36px */

/* Tipografia — pesos */
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
--font-weight-extrabold: 800
--font-weight-black: 900

/* Tipografia — entrelinhamento */
--line-height-tight: 1.1
--line-height-snug: 1.25
--line-height-normal: 1.5
--line-height-relaxed: 1.625

/* Border radius */
--radius-sm: 6px
--radius-md: 10px
--radius-lg: 14px
--radius-xl: 20px
--radius-2xl: 28px
--radius-full: 9999px

/* Sombras */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35)
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4)
--shadow-lg: 0 25px 50px -12px rgba(0, 0, 0, 0.5)
--shadow-gold: 0 0 30px rgba(212, 168, 75, 0.2)
--shadow-gold-strong: 0 8px 32px rgba(212, 168, 75, 0.35)

/* Motion — durações */
--duration-fast: 150ms
--duration-base: 200ms
--duration-slow: 300ms
--duration-slower: 500ms
--duration-count: 1000ms

/* Motion — easings (como CSS string) */
--ease-out: cubic-bezier(0, 0, 0.2, 1)
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1)
```

---

## 4. Escala de espaçamento

Tailwind 4 já gera escala de espaçamento via `--spacing: 0.25rem`. Os valores abaixo são referência semântica para o design system — usar classes nativas do Tailwind (p-4 = 16px, gap-6 = 24px, etc.).

| Referência | Valor | Uso típico |
|---|---|---|
| 4px (p-1) | 0.25rem | Gap mínimo entre elementos inline |
| 8px (p-2) | 0.5rem | Padding interno compacto |
| 12px (p-3) | 0.75rem | Padding de badge/chip |
| 16px (p-4) | 1rem | Padding padrão de input/card |
| 24px (p-6) | 1.5rem | Espaçamento entre seções |
| 32px (p-8) | 2rem | Padding de página mobile |
| 48px (p-12) | 3rem | Padding de página desktop |

---

## 5. Escala tipográfica canônica

| Role | Token | Classe Tailwind | Peso | Uso |
|---|---|---|---|---|
| Display | `--font-size-4xl` | `text-4xl` | black (900) | Preço em Pagamento |
| Heading 1 | `--font-size-3xl` | `text-3xl` | extrabold (800) | Saldo principal KPI |
| Heading 2 | `--font-size-2xl` | `text-2xl` | bold (700) | Títulos de seção |
| Heading 3 | `--font-size-xl` | `text-xl` | semibold (600) | Subtítulos de card |
| Body L | `--font-size-lg` | `text-lg` | medium (500) | Valores importantes |
| Body | `--font-size-base` | `text-base` | normal (400) | Texto corrido |
| Caption | `--font-size-sm` | `text-sm` | normal (400) | Labels, datas |
| Eyebrow | `--font-size-xs` | `text-xs` | semibold (600) | Categorias, chips |

---

## 6. Escala de border-radius canônica

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` (rounded-sm) | 6px | Badges inline, chips pequenos |
| `--radius-md` (rounded-md) | 10px | Inputs, botões secondary |
| `--radius-lg` (rounded-lg) | 14px | Cards, modais pequenos |
| `--radius-xl` (rounded-xl) | 20px | Cards KPI, bottom sheet |
| `--radius-2xl` (rounded-2xl) | 28px | Modais, PWA install prompt |
| `--radius-full` (rounded-full) | 9999px | Avatares, pills, FAB |

---

## 7. Sistema de elevação (sombras)

| Nível | Token | Quando usar |
|---|---|---|
| 0 — flat | nenhuma sombra | Itens de lista, linhas |
| 1 — raised | `shadow-sm` | Inputs, itens hover |
| 2 — elevated | `shadow-md` | Cards padrão |
| 3 — floating | `shadow-lg` | Modais, popovers |
| Gold | `shadow-gold` | Card KPI saldo (destaque) |
| Gold strong | `shadow-gold-strong` | Botão primário gold hover |

---

## 8. Motion system

| Token | Valor | Uso |
|---|---|---|
| `--duration-fast` | 150ms | Hover states, highlights |
| `--duration-base` | 200ms | Transições de rota, fade |
| `--duration-slow` | 300ms | Modais, slide-up |
| `--duration-slower` | 500ms | Animações compostas |
| `--duration-count` | 1000ms | Contagem de KPI numbers |
| `--ease-out` | cubic-bezier(0,0,0.2,1) | Elementos entrando na tela |
| `--ease-in-out` | cubic-bezier(0.4,0,0.2,1) | Transições bidirecionais |
| `--ease-decelerate` | cubic-bezier(0,0,0.2,1) | Slide-up modais |

**Regra obrigatória:** Todos os `@keyframes` e `transition` devem estar dentro de:
```css
@media (prefers-reduced-motion: no-preference) { ... }
```

---

## 9. Itens de trabalho para stories seguintes

| Story | Itens a implementar |
|---|---|
| 2.2 | MobileBottomNav: usar `--duration-fast` para active indicator. Sidebar: `--color-accent-gold` no item ativo |
| 2.3 | Cadastro/Login: substituir arbitrários Tailwind por tokens. Cards KPI: `shadow-gold`. Valores: `text-success`/`text-error` |
| 2.4 | Todos os keyframes: `--duration-*` e `--ease-*`. Ripple do botão gold: `--duration-slow` |
| 2.5 | Auditoria final — zero hardcoded hex em arquivos do epic 2 |

---

EROS VEREDITO
Completude:  ok — todos os 3 entregáveis criados
Precisão:    ok — baseado em leitura direta dos arquivos
Qualidade:   ok — categorizado por severidade com localização exata
Coerência:   ok — tokens alinhados com a identidade gold/dark existente
Utilidade:   ok — serve como referência executável para stories 2.2–2.5
Score: 5/5 | AUTORIZADO

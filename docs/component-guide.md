# Component Guide — Horizonte Financeiro
> Gerado por @design-system-architect | Story 2.1 | 2026-05-04  
> Referência de implementação para stories 2.2–2.5

---

## Regra de ouro

**Sempre prefer token de `src/index.css` antes de utilitário Tailwind com valor hardcoded.**

```jsx
// ❌ Errado
<p className="text-[#a3a3a3] text-[14px]">...</p>

// ✅ Correto
<p className="text-text-secondary text-sm">...</p>
```

---

## Paleta de cores — classes Tailwind 4

| Intenção | Classe | Token |
|---|---|---|
| Fundo base | `bg-bg-base` | `--color-bg-base` |
| Fundo de página | `bg-bg-primary` | `--color-bg-primary` |
| Fundo secundário | `bg-bg-secondary` | `--color-bg-secondary` |
| Fundo de card | `bg-bg-card` | `--color-bg-card` |
| Texto principal | `text-text-primary` | `--color-text-primary` |
| Texto secundário | `text-text-secondary` | `--color-text-secondary` |
| Texto muted | `text-text-muted` | `--color-text-muted` |
| Acento gold | `text-accent-gold` / `bg-accent-gold` | `--color-accent-gold` |
| Borda padrão | `border-border` | `--color-border` |
| Sucesso (receita) | `text-success` | `--color-success` |
| Erro (despesa) | `text-error` | `--color-error` |
| Aviso | `text-warning` | `--color-warning` |

---

## Tipografia — padrões por role

### Display — Preço/Saldo principal
```jsx
<span className="text-4xl font-black leading-tight tracking-tight text-text-primary">
  R$ 12.540,00
</span>
```

### KPI value — Valores em cards
```jsx
<span className="text-3xl font-extrabold leading-tight text-text-primary">
  R$ 3.200,00
</span>
```

### Section heading
```jsx
<h2 className="text-2xl font-bold leading-snug text-text-primary">
  Transações recentes
</h2>
```

### Card title
```jsx
<h3 className="text-xl font-semibold text-text-primary">
  Saldo total
</h3>
```

### Body text
```jsx
<p className="text-base font-normal leading-normal text-text-secondary">
  Conteúdo descritivo do app
</p>
```

### Label / Caption
```jsx
<span className="text-sm text-text-secondary">
  12 de maio
</span>
```

### Eyebrow / Category chip
```jsx
<span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
  Alimentação
</span>
```

---

## Border radius — padrões de uso

| Componente | Token | Classe |
|---|---|---|
| Badge / Chip inline | `--radius-sm` | `rounded-sm` |
| Input, botão secondary | `--radius-md` | `rounded-md` |
| Card padrão | `--radius-lg` | `rounded-lg` |
| Card KPI, bottom sheet | `--radius-xl` | `rounded-xl` |
| Modal, PWA prompt | `--radius-2xl` | `rounded-2xl` |
| Avatar, FAB, pill | `--radius-full` | `rounded-full` |

> **Regra:** Usar sempre a escala canônica. Proibido `rounded-[14px]` etc. — usar `rounded-lg`.

---

## Sombras — sistema de elevação

```jsx
// Nível 0 — flat (itens de lista)
<div className="border border-border">

// Nível 1 — raised (inputs, hover)
<div className="shadow-sm">

// Nível 2 — elevated (cards padrão)
<div className="shadow-md">

// Nível 3 — floating (modais)
<div className="shadow-lg">

// Gold — destaque (card saldo)
<div className="shadow-gold">
```

---

## Botão Primário Gold

```jsx
<button className="
  min-h-[44px] px-6 py-3
  rounded-lg font-semibold text-sm text-bg-primary
  bg-gradient-to-br from-[#f1d28b] via-accent-gold to-accent-gold-hover
  shadow-gold
  transition-all duration-fast ease-out
  hover:shadow-gold-strong hover:scale-[1.01]
  active:scale-[0.98]
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold
">
  Adicionar transação
</button>
```

> Área de toque mínima: 44×44px (WCAG 2.5.5)

---

## Botão Secondary / Ghost

```jsx
<button className="
  min-h-[44px] px-6 py-3
  rounded-lg font-medium text-sm text-text-secondary
  border border-border bg-transparent
  transition-all duration-fast ease-out
  hover:border-text-muted hover:text-text-primary
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold
">
  Cancelar
</button>
```

---

## Input padrão (dark theme)

```jsx
<input className="
  w-full min-h-[44px] px-4 py-3
  rounded-lg border border-border bg-bg-secondary
  text-base text-text-primary
  placeholder:text-text-muted
  outline-none
  transition-all duration-fast ease-out
  focus:border-accent-gold focus:ring-2 focus:ring-accent-gold-muted
"/>
```

---

## Card KPI

```jsx
<div className="
  rounded-xl p-6
  bg-bg-card border border-border
  shadow-gold
  transition-all duration-fast ease-out
  hover:scale-[1.01] hover:shadow-gold-strong
">
  <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
    Saldo total
  </span>
  <span className="block mt-2 text-3xl font-extrabold leading-tight text-text-primary">
    R$ 12.540,00
  </span>
</div>
```

---

## Linha de transação

```jsx
<div className="
  flex items-center gap-3 px-4 py-3
  border-b border-border
  transition-colors duration-fast ease-out
  hover:bg-bg-secondary
">
  {/* Ícone de categoria */}
  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center text-lg">
    🛒
  </span>

  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-text-primary truncate">Mercado Extra</p>
    <p className="text-xs text-text-muted">Alimentação · 12 mai</p>
  </div>

  {/* Valor — positivo ou negativo */}
  <span className="text-sm font-semibold text-error">-R$ 87,40</span>
  {/* Para receita: text-success */}
</div>
```

---

## Empty State

```jsx
<div className="flex flex-col items-center justify-center py-16 text-center px-6">
  <span className="text-5xl mb-4">📭</span>
  <p className="text-base font-semibold text-text-primary mb-1">Nenhuma transação ainda</p>
  <p className="text-sm text-text-muted mb-6">Comece registrando sua primeira receita ou despesa.</p>
  <button className="/* botão primário gold acima */">
    Adicionar transação
  </button>
</div>
```

---

## Skeleton (loading state)

```jsx
// Wrapper com crossfade ao substituir pelo conteúdo real
<div className="animate-pulse">
  <div className="h-8 w-40 rounded-lg bg-bg-secondary mb-2" />
  <div className="h-4 w-24 rounded-md bg-bg-secondary" />
</div>
```

> Regra: esqueleto deve ter **exatamente** o mesmo tamanho visual que o conteúdo real — sem layout shift.

---

## Modal (padrão)

```jsx
{/* Backdrop */}
<div className="fixed inset-0 z-[9000] bg-black/60 backdrop-blur-sm" />

{/* Dialog */}
<div className="
  fixed z-[9001] bottom-0 left-0 right-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
  w-full md:max-w-md
  rounded-t-2xl md:rounded-2xl
  bg-bg-card border border-border
  shadow-lg
  p-6
">
  {/* conteúdo */}
</div>
```

---

## Toast

```jsx
<div className="
  fixed top-4 right-4 z-[9500]
  min-w-[260px] max-w-xs
  rounded-lg px-4 py-3
  bg-bg-card border border-border shadow-md
  text-sm text-text-primary
">
  ✅ Transação salva com sucesso
</div>
```

---

## Contraste mínimo (WCAG)

| Elemento | Fundo | Texto | Ratio | Nível |
|---|---|---|---|---|
| Texto primário | `#0a0a0a` | `#f5f5f5` | ~18:1 | AAA ✅ |
| Texto secundário | `#0a0a0a` | `#a3a3a3` | ~6.3:1 | AA ✅ |
| Texto muted | `#0a0a0a` | `#737373` | ~4.6:1 | AA ✅ |
| Valor KPI | `#1a1a1a` | `#f5f5f5` | ~15:1 | AAA ✅ |
| Acento gold | `#0a0a0a` | `#d4a84b` | ~6.1:1 | AA ✅ |

> KPI numbers devem atingir AAA (7:1) — usar `text-text-primary` sobre `bg-bg-card` sempre.

---

## Animações — regra global

Toda animação deve ser envolvida em `@media (prefers-reduced-motion: no-preference)`.

```css
@media (prefers-reduced-motion: no-preference) {
  .fade-in {
    animation: fadeIn var(--duration-base) var(--ease-out) both;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
```

---

## Checklist de uso do design system

Antes de marcar qualquer AC como concluído em stories 2.2–2.5:

- [ ] Nenhum hex hardcoded em className (`text-[#xxx]`, `bg-[#xxx]`)
- [ ] Nenhum px hardcoded em border-radius (`rounded-[14px]`)
- [ ] Sombras usando `shadow-sm/md/lg/gold` — não inline style
- [ ] Tipografia usando `text-xs/sm/base/lg/xl/2xl/3xl/4xl` + `font-medium/semibold/bold/extrabold/black`
- [ ] Área de toque de todos os botões interativos ≥ 44px
- [ ] Animações dentro de `@media (prefers-reduced-motion: no-preference)`

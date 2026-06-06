# Spec — Modal "Nova Transação" (Neo-skeumorphism)

Referência de layout, tipografia, espaçamento, cores e sombras do modal `.modal-content--nova-tx`.
Valores extraídos direto do CSS (jun/2026). **Tudo `!important`** nesses partials por causa de
cascata legada — ao replicar, manter a mesma estratégia de especificidade.

## Arquivos-fonte

| Arquivo | Escopo |
|---|---|
| `src/pages/dashboard/partials/02c-modals-through-switch-ui.css` | Base `.modal-backdrop` / `.modal-content`; container mobile (centralizado) |
| `src/pages/dashboard/partials/16-modal-nova-tx-neumorphic-desktop.css` | **Desktop ≥769px** — tokens `--ntx-*` + todo o visual |
| `src/pages/dashboard/partials/22-mobile-foundation-neumorphic.css` | Definição dos tokens `--m-*` (mobile) |
| `src/pages/dashboard/partials/27-mobile-modal-nova-tx-fix.css` | **Mobile ≤768px** — visual + fixes (header, footer, drag) |
| `src/index.css` | Calculadora (`.ntx-calc*`), campo data/hora (`.ntx-datetime-row`), badge IA |

Breakpoint: **769px** (desktop `@media (min-width:769px)` / mobile `@media (max-width:768px)`).

---

## 1. Design Tokens

### Mobile `--m-*` (partial 22)

| Token | Dark | Light |
|---|---|---|
| `--m-base` | `#0b0e13` | `#eef1f6` |
| `--m-raised` | `#13161d` | `#ffffff` |
| `--m-sunken` | `#090b10` | `#e6eaf0` |
| `--m-light` | `rgba(255,255,255,0.045)` | `rgba(255,255,255,0.92)` |
| `--m-shadow` | `rgba(0,0,0,0.55)` | `rgba(159,174,197,0.40)` |
| `--m-shadow-soft` | `rgba(0,0,0,0.38)` | `rgba(159,174,197,0.26)` |
| `--m-edge-hi` | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.95)` |
| `--m-edge-lo` | `rgba(0,0,0,0.45)` | `rgba(150,165,188,0.22)` |
| `--m-text-hi` | `#f3f5f8` | `#0d1117` |
| `--m-text-mid` | `#97a4b6` | `#4a5568` |
| `--m-text-lo` | `#5c6b7c` | `#8896a5` |
| `--m-accent` | `#d4a84b` | `#b8832a` |
| `--m-accent-glow` | `rgba(212,168,75,0.22)` | `rgba(184,131,42,0.20)` |
| `--m-accent-fg` | `#1a1200` | `#ffffff` |
| `--m-pos` | `#4ade80` | `#15803d` |
| `--m-neg` | `#f87171` | `#b91c1c` |

### Desktop `--ntx-*` (partial 16)

| Token | Dark | Light |
|---|---|---|
| `--ntx-surface-base` | `#0e1117` | `#eef1f6` |
| `--ntx-surface-raised` | `#14181f` | `#ffffff` |
| `--ntx-surface-sunken` | `#0a0c11` | `#e4e8ee` |
| `--ntx-light` | `rgba(255,255,255,0.045)` | `rgba(255,255,255,0.90)` |
| `--ntx-shadow` | `rgba(0,0,0,0.70)` | `rgba(166,180,200,0.50)` |
| `--ntx-shadow-soft` | `rgba(0,0,0,0.45)` | `rgba(166,180,200,0.30)` |
| `--ntx-edge-hi` | `rgba(255,255,255,0.060)` | `rgba(255,255,255,0.95)` |
| `--ntx-edge-lo` | `rgba(0,0,0,0.50)` | `rgba(140,156,178,0.22)` |
| `--ntx-text-hi` | `#f3f5f8` | `#0d1117` |
| `--ntx-text-mid` | `#98a4b5` | `#4a5568` |
| `--ntx-text-lo` | `#5a6878` | `#8896a5` |
| `--ntx-text-faint` | `#3e4856` | `#b0bbc8` |
| `--ntx-accent` | `#d4a84b` | `#b8832a` |
| `--ntx-pos` | `#4ade80` | `#15803d` |
| `--ntx-neg` | `#f87171` | `#b91c1c` |
| `--ntx-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | (igual) |

> Os dois conjuntos são quase idênticos — `--m-*` e `--ntx-*` divergem só em micro-ajustes
> de superfície. O **acento gold** é `#d4a84b` (dark) / `#b8832a` (light) nos dois.

---

## 2. Tipografia

Duas famílias (variáveis):
- **`Plus Jakarta Sans Variable`** → títulos, valor hero, type-btn, botão primário, toggle de parcelamento.
- **`Inter Variable`** → section titles, labels, inputs (desktop), botão secundário, pills de atalho.

| Elemento | font-size | weight | letter-spacing | transform | família |
|---|---|---|---|---|---|
| **Título header** (desktop) | `1rem` (16px) | 700 | `-0.02em` | — | Plus Jakarta |
| **Título header** (mobile) | `1.15rem` (~18px) | 700 | `-0.02em` | — | Plus Jakarta |
| **Section title** (desktop) | `0.6875rem` (11px) | 700 | `0.18em` | UPPERCASE | Inter |
| **Section title** (mobile) | `0.6875rem` (11px) | 700 | `0.16em` | UPPERCASE | Inter |
| **Label** (desktop) | `0.75rem` (12px) | 600 | `0.02em` | none | Inter |
| **Label** (mobile) | `0.72rem` (~11.5px) | 600 | `0.01em` | none | Inter |
| **Label opcional** (sufixo) | herda | 500 | — | — | — |
| **Input** (desktop) | `0.9375rem` (15px) | 500 | `-0.005em` | — | Inter |
| **Input** (mobile) | **`16px`** ¹ | 500 | — | — | herda |
| **Valor hero** (desktop) | `2rem` (32px) | 700 | `-0.03em` | — | Plus Jakarta · `tabular-nums` · center |
| **Valor hero** (mobile) | `1.6rem` (~26px) | 700 | — | — | Plus Jakarta · center |
| **type-btn** (desktop) | `0.875rem` (14px) | 600 | `-0.005em` | — | Plus Jakarta |
| **type-btn** (mobile) | `0.9375rem` (15px) | 600 | — | — | Plus Jakarta |
| **Pill atalho** (Hoje/Ontem) desktop | `0.75rem` (12px) | 500 | — | — | Inter |
| **Pill atalho** (mobile) | `0.8125rem` (13px) | 500 | — | — | Inter |
| **Toggle parcelamento (texto)** | `0.875rem`(d)/`0.9375rem`(m) | 600 | — | — | Plus Jakarta |
| **Botão secundário** | `0.875rem`(d)/`0.9375rem`(m) | 600 | — | — | Inter |
| **Botão primário** | `0.9375rem` (15px) | 700 | `-0.005em` | — | Plus Jakarta |
| **Badge IA** | `0.6875rem` (11px) | 600 | — | — | herda |

¹ **16px no mobile é proposital** — abaixo disso o iOS dá zoom automático ao focar o input.

---

## 3. Container

### Backdrop
| | Desktop | Mobile |
|---|---|---|
| posição | `fixed; inset:0; flex center` | idem, `align/justify: center` |
| fundo | `rgba(0,0,0,0.55)` | `rgba(0,0,0,0.4)` (base 02c) |
| blur | `blur(12px) saturate(1.05)` | `blur(12px) saturate(180%)` ² |
| padding | `16px` | `max(12px, safe-area-top) 12px max(12px, safe-area-bottom)` |
| entrada | `ntxBackdropIn 240ms` | `fadeIn 0.3s` |

² **Durante o drag-to-close o blur é desligado** (`.modal-backdrop:has(.ntx-dragging/.ntx-closing)`)
para não re-rasterizar a cada frame — ver §8.

### Sheet (`.modal-content--nova-tx`)
| | Desktop | Mobile |
|---|---|---|
| border-radius | `22px` | `22px` |
| width | `min(96vw, 560px)` | `calc(100% - 24px)` |
| max-width | `560px` | `440px` |
| max-height | `70vh` (no body) | `min(88dvh, 100dvh − safe-areas − 28px)` |
| padding sheet | `0` (filhos cuidam) | `14px 20px 0` ³ |
| fundo | `linear-gradient(155deg, raised 0%, base 100%)` | idem com `--m-*` |
| layout | bloco | **flex-column** (header/body/footer) |
| entrada | `ntxSheetIn 280ms` (scale .95→1 + Y 8→0) | `modalMobileCenter 0.34s` |

³ `padding-bottom:0` no sheet mobile — a safe-area fica **só no footer** (evita faixa branca no iPhone).

---

## 4. Espaçamentos (paddings · gaps · margins · radii)

### Desktop
| Elemento | valor |
|---|---|
| Header | `padding: 18px 18px 0 20px`; `space-between` |
| Close btn | `border-radius: 50%` |
| Body | `padding: 4px 26px 14px`; `max-height: 70vh`; scroll-y |
| Section | `margin-bottom: 14px` |
| Section title | `gap: 10px`; `margin: 0 0 10px` (+ linha gradiente `::after`) |
| Form group | `margin-bottom: 10px`; label `margin-bottom: 6px` |
| Input | `padding: 12px 16px`; `radius: 12px` |
| Type toggle | `gap: 6px`; `padding: 5px`; `radius: 14px` |
| Type btn | `padding: 11px 18px`; `radius: 10px` |
| Valor | `padding: 18px 20px` |
| Date toolbar | `margin-bottom: 6px`; `gap: 12px` |
| Pill atalho | `padding: 5px 12px`; `radius: 999px` |
| Toggle parcelamento | `gap: 12px`; `padding: 12px 14px`; `radius: 12px`; iconWrap `36×36 / radius 10` |
| Footer | `gap: 10px`; `padding: 18px 26px 22px`; `border-top: edge-lo` |
| Btn secundário | `padding: 12px 22px`; `radius: 999px` |
| Btn primário | `padding: 12px 26px`; `radius: 999px` |

### Mobile
| Elemento | valor |
|---|---|
| Header | `gap: 12px`; `margin: 0 0 4px`; `padding: 0` |
| Grabber (`::before`) | `margin: 0 auto 12px` |
| Close btn | `36×36`; `radius: 50%` |
| Body | `padding: 2px 0 6px`; scroll-y; `flex: 1 1 auto` |
| Section | `margin-bottom: 9px` |
| Section title | `gap: 10px`; `margin: 0 0 10px` |
| Form group | `margin-bottom: 6px` (último `0`); label `margin-bottom: 3px` |
| Input | `padding: 9px 14px`; `radius: 12px` |
| Type toggle | `padding: 5px`; `radius: 14px` |
| Type btn | `padding: 12px 16px`; `radius: 10px` |
| Valor | `padding: 10px 16px` |
| Valor label-row | `margin-bottom: 7px` (label+botão calc na mesma linha) |
| Date toolbar | `margin-bottom: 7px` |
| Pill atalho | `padding: 7px 14px`; `radius: 999px` |
| Toggle parcelamento | `padding: 12px 14px`; `radius: 12px` |
| Footer | `gap: 10px`; `margin: 4px 0 0`; `padding: 11px 0 calc(8px + safe-area)`; `border-top: edge-hi` |
| Btn secundário | `padding: 12px 18px`; `min-height: 46px`; `radius: 999px`; `flex: 0 0 auto` |
| Btn primário | `padding: 12px 22px`; `min-height: 46px`; `radius: 999px`; `flex: 1 1 auto` |

---

## 5. Sombras neumórficas (receitas)

```css
/* SUNKEN — inputs, type-toggle track, pills, toggle parcelamento */
box-shadow: inset 2px 2px 5px var(--shadow-soft), inset -1px -1px 2px var(--light);
/* mobile usa 4px no 1º blur em alguns casos */

/* RAISED — sheet (desktop) */
box-shadow:
  14px 14px 36px var(--ntx-shadow),
  -8px -8px 24px var(--ntx-light),
  inset 1px 1px 1px var(--ntx-edge-hi),
  inset -1px -1px 1px var(--ntx-edge-lo);

/* PILL ATIVA — type-btn.active (despesa/receita) */
box-shadow: 3px 3px 8px var(--shadow-soft), -2px -2px 5px var(--light),
            0 0 0 1px var(--neg-glow | --pos-glow);

/* INPUT :focus — anel de acento */
box-shadow: inset 2px 2px 5px var(--shadow-soft), inset -1px -1px 2px var(--light),
            0 0 0 2px var(--accent-glow);

/* BOTÃO PRIMÁRIO (mobile) */
box-shadow: 5px 5px 14px var(--m-shadow-soft), -3px -3px 8px var(--m-light),
            0 0 16px var(--m-accent-glow);
```

Botão primário: `background: linear-gradient(155deg, accent 0%, color-mix(in srgb, accent 80%, black 20%) 100%)`;
texto `#1a1200` (dark) / `--m-accent-fg`.

---

## 6. Cor semântica do valor

O input do valor herda a cor do tipo selecionado, via `:has()` no body do modal:
```css
.modal-body--nova-tx:has(.type-btn.receita.active) input.input-valor-novo-tx { color: var(--pos); }
.modal-body--nova-tx:has(.type-btn.despesa.active) input.input-valor-novo-tx { color: var(--neg); }
```

---

## 7. Calculadora & Campo Data/Hora (`src/index.css`, tokens globais)

**Teclado calculadora** (`.ntx-calc`):
- display: `text-align:right`, `1.15rem/700`, `radius 12px`, fundo `--bg-secondary`, sombra inset.
- pad: `grid repeat(4,1fr)`, `gap 7px`.
- key: `padding 13px 0`, `radius 12px`, `1.1rem/600`; `:active scale(.95)`.
- operadores `--op` cor `--accent`; `C` `--clear` cor `--error`; `=` `--eq` `grid-column: span 3`, fundo `--accent`.

**Data + hora** (`.ntx-datetime-row` — flex, `gap 8px`):
- gatilho data: `flex: 1 1 0` + ícone gold sobreposto (`.ntx-date-cal`, `right:14px`, `pointer-events:none`).
- campo hora: `flex: 0 0 108px` (base explícita vence `width:100%` dos partials).
- calendário = `DatePickerBrPopover` (mesmo do modal de investimentos), portaled, `valueYmd`/`onSelectYmd`.

---

## 8. Animações & gestos

| | valor |
|---|---|
| Easing padrão | `cubic-bezier(0.22, 1, 0.36, 1)` (`--ntx-ease`) |
| Backdrop in (desktop) | `240ms` opacity |
| Sheet in (desktop) | `280ms` — `scale(.95) translateY(8px) → scale(1) translateY(0)` |
| Sheet in (mobile) | `modalMobileCenter 0.34s cubic-bezier(0.16,1,0.3,1)` |
| **Drag-to-close** (mobile) | só ≤768px e com o corpo no topo; dispara após `|dy| ≥ 6px` pra baixo; fecha se `dy > 110px` |
| Drag — transform | `translate3d(0, var(--ntx-drag), 0)` + `will-change: transform` (layer GPU) |
| Drag — fechar/voltar | transition `transform 0.3s cubic-bezier(0.22,1,0.36,1)` |
| Drag — perf | escritas em `requestAnimationFrame`; backdrop-blur OFF durante o gesto |
| Spinner (loading) | `ntxSpin(M) 800ms linear infinite` |

---

## 9. Notas de implementação

- **Tudo `!important`**: os partials antigos (02c, 04c, 07…) têm especificidade alta; o padrão é
  prefixar `body[data-theme='dark'|'light'] .modal-content--nova-tx …` e usar `!important`.
- **Título do header**: o `<h3>` é `.sr-only` no JSX e é "revelado" via CSS (anula `position/clip/width…`).
- **iOS input 16px**: nunca descer abaixo de 16px em inputs mobile (zoom automático).
- **iOS datetime**: `color-scheme` + `-webkit-text-fill-color` forçados (texto sumia quando o tema do
  sistema ≠ tema do app). Ícone de calendário custom = SVG no DOM (filter/bg-image somem no iOS).
- **Safe-area**: só no `.modal-actions` (footer). Sheet com `padding-bottom:0` no mobile.
- **Layout fixo**: sheet é `flex-column`; header e footer `flex:0 0 auto`; só `.modal-body--nova-tx` rola.

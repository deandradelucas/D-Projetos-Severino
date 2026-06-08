# Tokenização CSS — Plano de Migração (single source of truth)

> Branch: `release/1.0.4` (fora de produção). Objetivo: componentes lerem cor de `var(--token)`
> em vez de hardcoded, pra que tema = trocar valor em **um lugar** (`00-tokens-base.css`)
> e, no fim, os 3 arquivos dark (mirror/polish/fullblack) possam ser deletados.

## Fonte de verdade
- `src/index.css` → `@theme` (tokens Tailwind: fonte, tamanho, peso) + ordem de `@layer`.
- `src/pages/dashboard/partials/00-tokens-base.css` → tokens semânticos: `:root` (light) + `body[data-theme='dark']` (dark). **Este é o "token.css".**

## Realidade da auditoria (08-jun-2026)
- ~3.111 cores hardcoded + 3.689 regras inline `[data-theme]` nos 45 partials.
- Distribuição: cauda longa de opacidades bespoke (`rgba(255,255,255,0.08/0.1/0.12/0.06/0.05/0.14…`). NÃO é mapeamento limpo N→poucos tokens.

## Regra de segurança por ocorrência (MUST)
Antes de trocar `cor` → `var(--token)`:
1. **Invariante de tema** (valor igual em light e dark, ex: `#d4a84b`=`--accent`) → seguro em QUALQUER contexto.
2. **Variante de tema** (ex: `#ef4444`=`--error` só no dark; light=`#dc2626`) → só trocar se a regra já está escopada `body[data-theme='dark']`/`light` batendo o tema do token. Senão MUDA pixel.
3. **Bespoke sem token** (opacidade única) → NÃO inventar token 1:1. Deixar, ou propor token só se repetir ≥4x com mesma semântica.
Verificar build+lint+test:unit e raciocinar light+dark a cada fatia. Commit por fatia.

## Mapa canônico (invariantes confirmados)
| Hardcoded | Token | light | dark | Invariante? |
|-----------|-------|-------|------|-------------|
| `#d4a84b` | `--accent` | #d4a84b | #d4a84b | ✅ SIM |
| `#ef4444` | `--error` | #dc2626 | #ef4444 | ❌ dark-only |
| `#dc2626` | `--error`/`--danger` | #dc2626 | #ef4444 | ❌ light-only |
| `#f87171` | `--error-text` | #b91c1c | #f87171 | ❌ dark-only |
| `#15803d` | `--success-text` | #15803d | #4ade80 | ❌ light-only |
| `rgba(148,163,184,0.15)` | (card border, ver nota) | — | usado p/ borda dark | confirmar p/ tema |

## Fatias (ordem de execução)
- [ ] **Fatia 1 — gold da marca:** `#d4a84b` sólido → `var(--accent)` (invariante, ~21 ocorr.). RISCO ZERO.
- [ ] Fatia 2 — semânticas dark-scoped: dentro de regras `[data-theme='dark']`, `#ef4444→--error`, `#f87171→--error-text`, etc.
- [ ] Fatia 3 — semânticas light-scoped: análogo no light.
- [ ] Fatia 4+ — neutros estruturais (bg/borda) por partial, com juízo.
- [ ] Final — quando um componente é 100% token-driven, deletar seus overrides em mirror/polish/fullblack.

## Estado
- Pré-tokenização: redução de darks já fez −686 linhas (regras mortas + pares idênticos, commits #1–#11). Ver [[project-dark-css-reduction-2026-06]].

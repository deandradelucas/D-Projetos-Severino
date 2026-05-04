# Squad: Horizonte Frontend Premium

**Objetivo:** Elevar o PWA Horizonte Financeiro a nível premium/vendável.

**Epic:** 2 — Frontend Premium PWA  
**Criado em:** 2026-05-04  
**Framework:** Segunda-feira (SDC)

## Agentes

| ID | Papel | Responsabilidade |
|----|-------|-----------------|
| `design-system-architect` | Arquiteto do Design System | Tokens, auditoria, guia de componentes |
| `ux-director` | Diretor de UX | Direção visual, motion, mobile-first |
| `frontend-implementer` | Implementador Frontend | React/Tailwind, stories 2.2–2.4 |
| `visual-qa` | QA Visual | Consistência, acessibilidade, PWA |

## Sequência de Stories

```
2.1 Design System Audit & Token Foundation  →  design-system-architect
2.2 Shell & Navegação — Consistência Total  →  frontend-implementer
2.3 Páginas Core — Refinamento Visual       →  frontend-implementer
2.4 Micro-interações & Motion System        →  frontend-implementer
2.5 Visual QA & PWA Polish                  →  visual-qa
```

## Como executar

1. Abrir `docs/stories/2.1-design-system-audit.story.md`
2. Ativar `@design-system-architect` e executar a story
3. Seguir a sequência numerada — cada story depende da anterior
4. Story 2.5 fecha o epic com QA completo

## Restrições críticas
- **Shell Hub contrato estável** — nunca tocar no bloco marcado em `dashboard.css`
- **Sem libs de animação externas** — CSS puro + requestAnimationFrame
- **Sem mudanças de backend** — escopo 100% frontend
- `npm run lint` + `npm run test` devem passar antes de Done em qualquer story

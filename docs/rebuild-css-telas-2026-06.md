# Rebuild CSS — Telas do sistema (sessão noturna jun/2026)

Design: **Flat Soft-Cards** (fintech 2026, estilo Mercury/Ramp). Tokens globais em
`src/index.css`. Regras seguidas: **zero `!important`**, **zero import de legacy nos
partials novos**, escopo por página, responsivo (mobile ≤768 com inputs 16px),
`prefers-reduced-motion`.

## Telas reconstruídas no flat (esta sessão)

| Tela | Partial novo | Status | Legacy removido? |
|------|--------------|--------|------------------|
| Investimentos | `src/styles/pages/investimentos.css` | ✅ + QA gaps fechados | n/a (só dashboard.css) |
| Agenda | `src/styles/pages/agenda.css` | ✅ (modal próprio ganhou card base) | n/a |
| Listas | `src/styles/pages/listas.css` | ✅ (item + modo comprando + modais) | n/a |
| Configurações | `src/styles/pages/configuracoes.css` | ✅ + QA gaps fechados | n/a |
| Relatórios | `src/styles/pages/relatorios.css` | ✅ (hero editorial + charts) | n/a |
| Pagamento | `src/styles/pages/pagamento.css` | ✅ (checkout) | n/a |
| Cartões | `src/styles/pages/cartoes.css` | ✅ | **sim** (legacy/cartoes.css) |
| Metas | `src/styles/pages/metas.css` | ✅ | **sim** (legacy/metas.css) |

Componentes flat já existentes (sessões anteriores): transaction-modal, date-popover,
horizon-chat, confirm-dialog, dashboard, transacoes, shell/sidebar/mobile-nav.

## Processo por tela (cauteloso)
1. Inventário COMPLETO de classes (página + componentes).
2. Partial flat autorado do zero a partir do DOM/BEM — sem portar neumorfismo.
3. Import adicionado no JSX após `./dashboard.css`.
4. Coverage diff (classes do JSX vs CSS) — fechar gaps reais (modificadores que
   herdam base são aceitáveis).
5. `npm run build` + `eslint` verdes; commit atômico.

## PENDÊNCIAS para análise da Segunda-feira / revisão do CEO

1. **Revisão VISUAL por tela** — o CSS foi autorado a partir do DOM (sem render ao
   vivo). Cada tela precisa de conferência no device (desktop + mobile). Provável
   ajuste fino de espaçamentos/tamanhos.
2. **`from-index.css` (legacy) ainda importado em `src/main.jsx`** — estiliza
   Login, Cadastro, BemVindoAssinatura, páginas legais e Trial. NÃO foi removido
   (risco de quebrar o login/acesso). Migrar essas telas de entrada para flat e
   então remover o import é o próximo passo (requer cuidado: Login é multi-step).
3. **BemVindoAssinatura / TrialExpirado** ainda importam seus CSS legacy próprios
   (`legacy/bem-vindo-assinatura.css`, `legacy/trial-expirado.css`). Migrar para flat.
4. **Gráficos (Relatórios/Investimentos)** usam recharts — só os contêineres/legendas
   foram estilizados; cores internas dos charts podem precisar de ajuste via props.
5. **Tema escuro** — os tokens flat têm modo dark (`body[data-theme='dark']`), mas as
   telas novas não foram testadas no dark. Verificar contraste.

## Gates validados (todos os partials novos)
- `!important` real: **0**
- Import de legacy nos partials novos: **0**
- `npm run build`: **OK**
- `eslint` nas páginas tocadas: **OK**

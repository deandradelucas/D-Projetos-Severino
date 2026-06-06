# Auditoria do Sistema — Severino (06/jun/2026)

Auditoria full-stack via 4 agentes paralelos (frontend, CSS/design-system, backend/segurança, caça-bugs) + diagnósticos automáticos + Supabase Security Advisor. Achados verificados manualmente nos pontos críticos.

## Diagnósticos automáticos (baseline)
- `lint`: 0 erros (1 warning pré-existente em Transacoes.jsx:670)
- `build`: ✅ · `test:unit`: **224 passam** / 1 skip
- `audit:dashboard-css`: 60 classes sem uso (38 reais, 22 falsas-negativas geradas via template)
- `audit:orphan-exports`: 93 exports órfãos / 23 arquivos
- `audit:orphan-endpoints`: 1 sem consumidor (`GET /api/lista-compras/arquivadas`)
- `audit:orphan-files/assets`: 0

---

## ✅ CORRIGIDO nesta sessão (Opção A)
1. **Rate limit nunca bloqueava** (`register-metas.mjs:41,94` + `register-cartoes.mjs:89`) — `rateLimitTake` é async, chamado sem `await` → `!Promise` sempre false. **Fix:** `await`. (cartões não estava no relatório dos agentes — encontrado na verificação)
2. **Rendimento/IR divergente front×back** (`investimentos-rendimento.mjs:53`) — feriado Consciência Negra (20/nov) sem guard de ano; front só conta ≥2023. **Fix:** `if (year >= 2023)`.
3. **`investimento_aportes` sem RLS** (migration 34) — única tabela financeira sem RLS. **Fix:** migration `69_investimento_aportes_rls.sql` **aplicada no banco** (confirmado pelo advisor).
4. **Wildcard injection na busca** (`transacoes.mjs:391,431`) — `ilike` sem escapar `%`/`_`. **Fix:** helper `escapeIlike`.

## ❌ Falsos-positivos / overstated (verificados — NÃO são bugs)
- **Agenda modal trava no 401** (`Agenda.jsx:306`) — o `finally` (315-318) sempre roda `setSaving(false)`. Não trava.
- **`new Function()` na calculadora** (`TransactionModal.jsx:224`) — regex `^[\d\s+\-*/().]+$` é allowlist forte (sem letras/identificadores) → não explorável. Code smell/CSP apenas.
- **Cancelar assinatura IDOR** (`register-pagamentos.mjs:264`) — lê `asaas_subscription_id` do próprio usuário (`.eq('id', usuarioId)`); membro sem assinatura recebe 404. Sem IDOR.

---

## 🔴 CRÍTICOS / 🟠 ALTOS pendentes (não corrigidos)

### Backend / segurança
- **`limites_orcamento` policy `USING(true)` para ALL** (Supabase advisor WARN) — revisar a qual role se aplica; se anon/authenticated, é acesso irrestrito a orçamentos.
- **`GET /api/pagamentos/minhas` chama Asaas em tempo real** (`register-pagamentos.mjs:80`) — viola SYNC>CACHE>REAL-TIME; risco 429 derrubar a tela. Mover sync pro cron.
- **Login sem rate-limit por email** (`register-auth.mjs:25`) — só por IP.
- **Cron secrets sem comparação timing-safe** (`recorrencias-mensais.mjs:254`, `agenda-route-auth.mjs:22`).
- **CPF/CNPJ sem validar dígito** (`register-pagamentos.mjs:120`).
- **`DEFAULT_SUPER_ADMIN_EMAIL` hardcoded** (`super-admin.mjs:7`) — falhar em prod se env ausente.

### Bugs de domínio (dinheiro/timezone) — verificar/corrigir
- **`contarDiasUteis` server conta o dia da aquisição** (`investimentos-rendimento.mjs:76`) — CDI é D+1; superestima 1 dia útil. Diverge do front.
- **IR de múltiplos aportes mostra alíquota do último** (`investimentos-rendimento.mjs:183`).
- **Parcelas pendentes ativadas por data UTC** (`parcelas-pendentes.mjs:15`) — vira o dia cedo às 21h BRT.
- **Alertas financeiros usam mês UTC** (`alertas-financeiros.mjs:10`) — mês errado nas últimas 3h.
- **WhatsApp bot grava transação em data UTC** (`whatsapp-bot.mjs:197`) — "hoje" vira dia seguinte às 22h+.
- **`limites_orcamento`** (ver acima).

### Gaps de teste (ZERO cobertura em lógica de dinheiro)
- `server/lib/investimentos-rendimento.mjs`, `parcelas-pendentes.mjs`, `import/import-service.mjs`, `whatsapp-bot.resolveDataTransacaoParaBot`.

---

## 🟡 PADRONIZAÇÃO (o que dá pra unificar)
- **`formatCurrencyBRL` duplicado** — `ListaDeCompras.jsx:148` reimplementa; `TransactionModal.jsx` instancia `Intl.NumberFormat` 4× no render. Usar o singleton de `lib/formatCurrency.js`.
- **Modais sem a11y** — `ListaDeCompras` (4 modais) e `Cartoes` (FaturasModal) não usam `useModalA11y` (focus-trap/Escape/scroll-lock).
- **Toast local** em `Configuracoes.jsx:71` — usar `showToast` global.
- **`fetchCategorias` em 4 lugares sem cache** — extrair pra context com TTL.
- **Bloco FAB gold duplicado 5×** (07, 07b×2, 05, 36) — consolidar num único.

## 🟡 CSS / design-system
- **Import CSS duplicado** em `dashboard.css` — `17-investimentos-neumorphic-desktop.css` importado 2× + prefixos 16/17 colidentes.
- **8.637 `!important`** (18:768, 15:723, 23:683, 05:577…) — sintoma de luta por especificidade.
- **`--accent-rgb` usado mas nunca definido** (12-page-lista-compras.css, 6×) — só funciona pelo fallback.
- **14 classes CSS órfãs** seguras de remover (incl. `page-lista-compras__category-header/icon`).
- **2 sistemas de token de cor** (`index.css @theme --color-*` vs `00-tokens-base.css --*`).
- **`transition: all 0.2s`** em itens de lista longa.
- **`:has(:not():not())`** frágeis (05:2452, 07b:9) — inverter pra opt-in.
- **`@keyframes` sem guard `prefers-reduced-motion`** (07:1547,1859; 06:170).

## 🟡 Manutenção
- **`ListaDeCompras.jsx` = 2.487 linhas** com 6 modais + lookups inline.
- **`useVirtualizer` com `count:0`** (Transacoes.jsx:220) — código morto.
- **93 exports órfãos** + **`GET /api/lista-compras/arquivadas`** sem consumidor.

## ℹ️ Supabase Security Advisor (06/jun)
- `investimento_aportes` corrigido (saiu da lista).
- 17 tabelas "RLS enabled, no policy" = deny-all + service_role = **seguro** (padrão do projeto).
- 1 WARN: `limites_orcamento` policy permissiva (`USING true` ALL).

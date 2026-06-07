# Auditoria Multi-Agente (Squad Segunda-feira) — Severino

> **Data:** 2026-06-07 | **Branch:** release/1.0.3
> **Método:** 4 auditores especializados em paralelo (@security-auditor, @architect/backend, @dev/frontend, @architect/performance), consolidados pelo orquestrador.
> **Escopo:** somente leitura — nenhuma alteração feita. Débito de `!important` no CSS excluído (campanha dedicada em andamento).

## Placar

| Eixo | Crítico | Alto | Médio | Baixo |
|---|---|---|---|---|
| Segurança | 2 | 3 | 4 | 2 |
| Backend/DB | 1 | 4 | 5 | 3 |
| Frontend | 2 | 3 | 4 | 3 |
| Performance | 1 | 4 | 4 | 1 |

Security score atribuído pelo auditor: **6.5/10** (acima da média para SaaS inicial; pontos fortes documentados no fim).

---

## 🔴 CRÍTICOS (corrigir em 24-72h)

### C1 — Chaves de API reais em `.env`/`.env.production` no working tree `[SEC-01]`
`.env` (N8N_API_KEY) e `.env.production` (ASAAS_API_KEY de **produção**) existem no diretório. Estão no `.gitignore`, mas um `git add .` acidental vaza a chave Asaas de produção (acesso total a cobranças/assinaturas de todos os clientes) para o histórico Git permanentemente.
**Ação:** (1) rotacionar ASAAS_API_KEY + N8N_API_KEY agora; (2) pre-commit hook anti-segredo (husky + detect-secrets); (3) migrar produção para gestor de segredos.

### C2 — Tabelas sensíveis sem RLS: `admin_audit_log`, `familia_convites` `[SEC-02]`
Criadas nas migrations 13 e 21, nunca receberam `ENABLE ROW LEVEL SECURITY`. Com a anon key (pública no frontend), qualquer um faz SELECT via PostgREST e lê o log de auditoria admin (IPs, e-mails) e os `token_hash` de convites familiares.
**Ação:**
```sql
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.familia_convites ENABLE ROW LEVEL SECURITY;
```
Rodar Supabase Advisor (`rls_disabled`) para varrer outras.

### C3 — `SELECT *`/`select()` vaza `senha_hash` e `refresh_token_hash` pela rede `[BACKEND-1 / cross-security]`
`server/lib/usuarios-admin.mjs:218,409` — a listagem admin faz `.select()` sem colunas → PostgREST retorna **todos** os campos, incluindo `senha_hash`, `refresh_token_hash`, `email_otp_hash`. Trafega hashes sensíveis Supabase→servidor sem necessidade.
**Ação:** constante `USUARIOS_ADMIN_COLS` com colunas explícitas (sem campos secretos) nas linhas 218, 397, 409, 445, 496.

### C4 — Backup pode estar **silenciosamente truncado** (risco de perda de dados) `[BACKEND-4]`
`server/lib/rclone-backup.mjs:117` faz `.from(table).select('*')` sem `.range()`. O PostgREST limita a 1.000 linhas por padrão → o backup JSON de `transacoes` (cresce sem limite) pode estar **incompleto sem erro**. Um restore falharia silenciosamente.
**Ação:** usar `pg_dump` (`createPostgresSqlDump` já existe — validar `SUPABASE_DB_URL`) ou paginar com `.range()`. **Verificar integridade do último backup imediatamente.**

### C5 — `vendor-jspdf` (431 KB) baixado por 100% dos usuários `[PERF-1]`
`Relatorios.jsx:16` importa `relatorioExportPdf.js` estaticamente → o chunk jspdf entra no grafo do entry e ganha `modulepreload` no `index.html`. Todo usuário baixa 431 KB mesmo sem nunca exportar PDF.
**Ação:** mover o import de `relatorioExportPdf.js` para dentro do `import('jspdf')` dinâmico (o módulo já aceita `JsPdfCtor` por injeção). −431 KB do caminho crítico.

---

## 🟠 ALTOS

### Segurança
- **A1 `[SEC-03]`** Refresh token em `localStorage` (`src/lib/horizonteAccessToken.js:33`) → roubável por qualquer XSS (sessão de 30 dias). Migrar para cookie `HttpOnly; Secure; SameSite=Strict` (mesma origem já viabiliza).
- **A2 `[SEC-04]`** CORS aceita `http://` para `mestredamente.com` (`server/app.mjs:35`, regex `https?`). Trocar para `https` apenas (risco MITM).
- **A3 `[SEC-05]`** Webhook WhatsApp compara token com `!==` (timing attack) — `whatsapp-evolution-inbound.mjs:551`. Usar `safeEqualStr` (já existe; o webhook Asaas já usa timing-safe).

### Backend/DB
- **A4 `[BACKEND-2]`** `marketing-stats.mjs:23,74` carrega TODOS os usuários e pagamentos em memória sem paginação → OOM ao escalar (300 ok hoje, quebra em ~5-10k). Trocar por agregação SQL (`COUNT/SUM/GROUP BY`) ou snapshot por cron.
- **A5 `[BACKEND-3]`** N+1: `assinatura-db.mjs:82-127` faz 4 queries sequenciais à `usuarios` por login (+40-80ms/req). Unificar em 1 SELECT com todas as colunas.
- **A6 `[PERF-4]`** Falta índice `(usuario_id, recorrente_grupo_id, status)` → table-scan em toda query da aba Parceladas. `CREATE INDEX ... WHERE recorrente_grupo_id IS NOT NULL`.

### Frontend/Performance
- **A7 `[FE-2]`** 9 modais com `role="dialog"` sem focus trap nem Escape (Metas, Agenda, Pagamento, Configuracoes, AdminUsuarios, 3 de investimentos, AdminPaymentLogs). `useModalA11y` só está em 3 modais. A11y real quebrada para teclado/leitor de tela. Aplicar `useModalA11y` em todos ou criar `<Modal>` wrapper.
- **A8 `[PERF-2]`** `line-awesome.min.css` (89 KB) importado em `main.jsx` para **2 ícones** (`la-sun`/`la-moon` em ConfigAparenciaCard). Substituir por SVG inline e remover o import. CSS inicial total: 1,44 MB.
- **A9 `[PERF-3]`** Logos PNG de **1,3-2 MB** em `public/images/Nova Logo/` (e `pwa-app-icon.png` 571 KB renderizado a 28px). `brandAssets.js` aponta para os PNGs pesados. Converter para SVG (já existe `SeverinoMark.jsx`) / WebP → −3,5 MB.
- **A10 `[PERF-5]`** `syncRecorrenciasMensais` disparado 2× no 1º fetch de Transações (TransactionCacheContext:63 + Transacoes.jsx:167). Centralizar no Context.

---

## 🟡 MÉDIOS (resumo)

| ID | Arquivo | Achado |
|---|---|---|
| SEC-06 | register-auth.mjs:145 | Senha mínima 6 chars (NIST recomenda ≥8) |
| SEC-07 | super-admin.mjs:7 | E-mail super-admin hardcoded |
| SEC-08/BACKEND-10 | rate-limit.mjs | Rate limit in-memory perde estado no restart PM2 (configurar REDIS_URL em prod) |
| SEC-09 | rate-limit.mjs:62 | `X-Forwarded-For` confiável sem validação → bypass de rate limit (configurar trustedIPs no Traefik) |
| BACKEND-5 | register-pagamentos.mjs:88 | Cooldown de sync Asaas em Map() (zera no restart → burst à API) |
| BACKEND-6 | agenda.mjs:191 | `agenda_eventos select('*')` sem limit |
| BACKEND-7 | transacoes.mjs:120 | Seed de 24 categorias em inserts sequenciais (1º acesso lento) |
| BACKEND-8 | pagamentos-asaas.mjs:272 | Lookup `payer_email` sem fuzzy (typo → não encontrado; viola data-lookup-safety) |
| FE-3 | Transacoes/Relatorios/TransactionModal | `fetchCategorias` triplicado sem cache (categorias mudam raramente) → mover ao Context |
| FE-4 | Pagamento.jsx:364 | `exhaustive-deps` suprimido lendo estado defasado (CPF do Pix) |
| FE-5 | Dashboard vs Transacoes | Cálculo de totais duplicado e **divergente** (Dashboard exclui PENDENTE, calcularQuickTotals não) |
| PERF-7 | Relatorios.jsx:181 | 5 requests paralelos na montagem; categorias sem cache compartilhado |
| PERF-8 | TransactionCacheContext:100 | Polling global de 45s mesmo em páginas não-financeiras |
| PERF-9 | transacoes.mjs:278 | `.insert().select()` sem projeção |

## 🟢 BAIXOS (resumo)

| ID | Achado |
|---|---|
| SEC-10 | Token do webhook WhatsApp no path da URL (vaza em logs) |
| FE-1/PERF-6 | `useVirtualizer({count:0})` morto em Transacoes.jsx:228 (dead weight + 2 effects dependem de índice sempre −1) |
| FE-11 | `const chartMono = false` resíduo em Relatorios.jsx:54 |
| FE-12 | `menuAberto` duplicado em 14 páginas (candidato a SidebarContext) |
| BACKEND-11 | Fallbacks de coluna `42703` obsoletos (migrations já aplicadas) |
| BACKEND-12 | `exportarDadosUsuario` (LGPD) sem limit por tabela |
| PERF-10 | Sem `preconnect` para Supabase no index.html |

---

## God Components (refatorar por extração de hooks)

| Arquivo | Linhas | useState |
|---|---|---|
| Transacoes.jsx | 1233 | ~18 |
| ListaDeCompras.jsx | 1217 | 24 |
| TransactionModal.jsx | 1036 | ~12 |
| Relatorios.jsx | 957 | ~15 |
| Pagamento.jsx | 951 | 23 |
| Configuracoes.jsx | 889 | **28** |
| ListaModais.jsx | 829 | 24 |

Maiores .mjs backend: agenda-whatsapp (904), whatsapp-bot (771), pagamentos-asaas (761), lista-compras (706), whatsapp-evolution-inbound (605).

---

## ✅ O que já está bem feito (não tocar)

**Segurança:** JWT HS256 + timingSafeEqual; access token só em memória; refresh token com hash SHA-256 no banco + rotação; rate limit duplo (IP+email); HSTS/CSP/X-Frame/nosniff; `escapeIlike` anti-wildcard; SSRF mitigation no webhook; webhook Asaas timing-safe; bcrypt custo 10; RLS em 16/18 tabelas.
**Backend:** try/catch em todos os handlers (sem vazar stack); SYNC>CACHE respeitado no core (Asaas via webhook, Gemini só em POST); range de data correto (`lt(diaSeguinte)`); dedup de `recorrente_grupo_id`.
**Performance:** lazy-routes + Suspense em 20 páginas; prefetch no hover com dedup; manualChunks; cache CDI/Selic com TTL; gzip/brotli; sem sourcemaps em prod; índices principais de `transacoes`.

---

## Roteiro sugerido (ordem de execução)

1. **Hoje:** C1 (rotacionar chaves) + C2 (RLS) + C4 (verificar integridade do backup).
2. **Esta semana:** C3, C5, A2, A3, A6 (índice), A8 (line-awesome), A10.
3. **Próxima:** A1 (cookie httpOnly), A4/A5 (queries), A7 (a11y modais), A9 (imagens).
4. **Backlog:** médios/baixos + extração de hooks dos god components.

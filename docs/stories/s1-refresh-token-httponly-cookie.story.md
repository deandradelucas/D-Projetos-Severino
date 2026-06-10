# Story S1 — Refresh token em cookie HttpOnly

**Status:** Done — deployada e validada em produção (10/jun, commit 978e100)

## Smoke em produção (10/jun)
- Login → `Set-Cookie: horizonte_rt=<token>; Max-Age=2592000; Path=/api/auth; HttpOnly; Secure; SameSite=Strict`; body sem refreshToken ✅
- Refresh via cookie → 200 + accessToken + rotação ✅ · refresh com token rotacionado → 200 ✅
- Logout → cookie expirado (`Max-Age=0`) ✅ · refresh pós-logout → rejeitado ✅
- Token legado inválido no body → 401 ✅

## Incidente descoberto e corrigido durante o smoke
O cookie veio sem `Secure` → investigação revelou que **`NODE_ENV` e `HORIZONTE_ACCESS_TOKEN_SECRET` não existiam no .env da VPS**: produção assinava JWTs com o fallback de dev (público no repo) — access tokens forjáveis. Corrigido com aprovação do CEO: secret aleatório gerado na VPS + `NODE_ENV=production` + restart. **Prova:** token forjado com o secret de dev agora retorna 401. Access tokens antigos morreram no restart; o refresh automático reemitiu sem deslogar ninguém. Backup do .env em `/home/lucas/severino/.env.bak-jwt` (chmod 600). · **Origem:** Auditoria squad 07/jun (A1/SEC-03) + backlog `docs/melhorias-backlog-2026-06.md`

## Problema
O refresh token (sessão de 30 dias) vive em `localStorage` (`horizonteAccessToken.js`). Qualquer XSS o exfiltra e ganha a conta por 30 dias, mesmo com o access token só em memória.

## Solução
Refresh token vira cookie **`HttpOnly; Secure(prod); SameSite=Strict; Path=/api/auth`** emitido pelo servidor. JS nunca mais vê o token. XSS no máximo renova um access token de 15min enquanto a página está aberta — não exfiltra a sessão longa.

## Acceptance Criteria
1. [x] Login, cadastro (login senha, register, verify-registration, verify-email-otp), WebAuthn e refresh **setam o cookie** e **NÃO retornam `refreshToken` no body** (exceto AC4).
2. [x] `/api/auth/refresh` aceita o token **do cookie** (caminho novo); resposta = `{ accessToken }` + rotação do cookie.
3. [x] `/api/auth/logout` revoga o token do cookie e/ou do body e **limpa o cookie**.
4. [x] **Transição sem derrubar sessões:** `/refresh` aceita token via body (legado); resposta do caminho-body inclui `refreshToken` (bundle antigo exige) E seta o cookie. Front novo com token legado envia-o uma vez e apaga o localStorage após sucesso.
5. [x] Front: nenhum código grava refresh token em `localStorage` (Login/Cadastro limpos); bootstrap usa `horizonte_user` como marcador de sessão.
6. [x] Cookie `Max-Age` = TTL (default 30d, Max-Age=2592000); `Secure` só em produção (coberto por teste).
7. [x] Testes: `server/tests/auth-cookie.test.mjs` (5 — atributos, Secure em prod, leitura, clear).
8. [x] lint + test:unit + build verdes.

## Out of scope
- Mudar TTLs, esquema da tabela `refresh_tokens`, rotação (já existe), contagem de sessões.
- Remover o caminho legado por body (cleanup futuro, após período de transição).

## File List
- `server/lib/auth-cookie.mjs` (novo)
- `server/routes/register-auth.mjs` · `server/routes/register-auth-webauthn.mjs`
- `src/lib/authRefresh.js` · `src/lib/bootstrapHorizonteSession.js` · `src/lib/logout.js` · `src/lib/horizonteAccessToken.js`
- `src/pages/Login.jsx` · `src/pages/Cadastro.jsx`
- `server/tests/auth-cookie.test.mjs` (novo)

## Riscos
- Bundle antigo aberto em aba: coberto pelo AC4 (body legado mantido no /refresh).
- iOS PWA: cookie HttpOnly first-party setado por servidor NÃO sofre o cap de 7 dias do ITP (só storage gravável por script) — sem regressão de duração de sessão.

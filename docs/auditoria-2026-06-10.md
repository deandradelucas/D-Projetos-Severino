# Auditoria do Sistema — Severino (10/jun/2026)

Auditoria incremental sobre o delta desde a auditoria de 06/jun (`docs/auditoria-2026-06.md`), cobrindo os 16 commits da release 1.0.4 (01763b4..f3888bf): OTP de e-mail/telefone logado, alterar senha, biometria friendly_name, repaginação Listas/Pagamento/Config/Dashboard/PWA. 3 agentes paralelos (backend/segurança, frontend, verificação de pendências) + diagnósticos automáticos. Achado principal confirmado manualmente.

## Diagnósticos automáticos (baseline)
- `lint`: ✅ 0 erros
- `test:unit`: ✅ **318 passam** / 1 skip (era 224 em 06/jun — +94 testes)

---

## 🟠 ALTOS — código novo (v1.0.4)

1. ✅ **CORRIGIDO** — **Sem rate limit nos 4 endpoints novos de OTP** (`register-usuario-perfil.mjs`) — adicionado `rateLimitTake` duplo (IP 10/h + usuário 5/h) no envio e por usuário (5/15min) na verificação, com chaves separadas por canal (`perfil-otp-email-*`, `perfil-otp-tel-*`).
2. ✅ **CORRIGIDO** — **Sem rate limit em alterar senha** — `rateLimitTake('perfil-senha:'+usuarioId, 5, 15min)`.

## 🟡 MÉDIOS — código novo

3. ✅ **CORRIGIDO** — **Comparação de hash OTP com `!==`** — `email-otp.mjs` e `registration-otp.mjs` agora usam `safeEqualStr` (`safe-equal.mjs`).
4. ✅ **CORRIGIDO** — **Troca de senha não revoga sessões** — `revogarSessoesUsuario(usuarioId)` chamado após o update; refresh tokens antigos morrem (access token atual vale até expirar, ~15min).
5. ✅ **CORRIGIDO** — **Pepper de OTP com fallback hardcoded** — `pepper()` agora lança em `NODE_ENV=production` se `PASSWORD_OTP_PEPPER`/`HORIZONTE_OTP_PEPPER` ausente. ⚠️ **PRÉ-REQUISITO DE DEPLOY:** setar `PASSWORD_OTP_PEPPER` no `.env` da VPS ANTES de subir este código — o pepper não está nos `.env` locais (só em `env.example`) e o PM2 roda com `NODE_ENV=production`; sem a env, TODO o fluxo de OTP (cadastro + perfil) passa a dar 500.
6. ❌ **FALSO-POSITIVO** — **`friendly_name` sem limite de tamanho** — verificado: `deviceLabelFromUA` (`webauthn.mjs:141-159`) nunca retorna o User-Agent bruto; o output é sempre de um conjunto fixo de labels curtos ("iPhone · Chrome", máx ~26 chars). Sem fix necessário.
7. ✅ **CORRIGIDO** — **OTP reenvio sem cooldown no front** — cooldown de 30s com contagem regressiva no botão "Reenviar código" + guard de reentrada via ref (`Configuracoes.jsx` / `ConfigPerfilCard.jsx`).
8. **PwaInstallPrompt: instrução do Safari em Chrome iOS** (`PwaInstallPrompt.jsx:26-29,147`) — `isIosDevice()` é true para CriOS/FxiOS, mas a instrução de instalação é específica do Safari. *(pendente)*

## 🔵 BAIXOS — código novo

9. **Endpoints novos sem `assertAcessoAppUsuario`** (`register-usuario-perfil.mjs` — 5 handlers) — inconsistente com o resto do arquivo; usuário expirado consegue disparar e-mail/WhatsApp e trocar senha. Impacto baixo (dados próprios) — decidir se é exceção intencional.
10. **Senha mínima 6 chars** (`register-usuario-perfil.mjs:227`) — NIST recomenda 8; oportunidade de elevar na troca sem quebrar contas antigas.
11. **`salvarNome`: `JSON.parse` sem try/catch** (`Configuracoes.jsx:282`) — localStorage corrompido deixa o campo de edição aberto sem toast.
12. **`excluirConta`: busy não reseta em `finally`** (`Configuracoes.jsx:331-346`) — se `logoutHorizonte` falhar, botão trava para sempre.
13. **`duplicarLista`: falhas parciais silenciosas** (`ListaDeCompras.jsx:672-685`) — loop não checa `res.ok`; toast de sucesso mesmo com lista incompleta.
14. **`IconClipboard` sem width/height** (`ListaIcons.jsx:121`) — único ícone do arquivo sem dimensões; padrão conhecido de sumiço no iOS.

## ✅ O que está bem feito (código novo)
- IDOR impossível nos endpoints novos: tudo opera pelo `usuarioId` do JWT, nunca do body.
- Alterar senha exige senha atual (`bcrypt.compare`) + hash bcrypt rounds 10.
- OTP: CSPRNG (`crypto.randomInt`), nunca em plaintext (SHA-256+pepper+userId), expira em 15min, invalidado após uso, hash limpo se envio falha.
- `friendly_name` derivado só do User-Agent no servidor (não input direto) + 5 unit tests.
- Migration 73 não-destrutiva (`ADD COLUMN IF NOT EXISTS`).
- Sem enumeração de e-mail/telefone entre usuários.

---

## 📋 Pendências da auditoria de 06/jun — status verificado

| # | Pendência | Status |
|---|-----------|--------|
| 1 | `/api/pagamentos/minhas` real-time Asaas | ✅ Corrigida — cooldown `_ultimoSyncPagamentos` (`register-pagamentos.mjs:88-93`) |
| 2 | Login sem rate-limit por email | ✅ Corrigida (`register-auth.mjs:43-45`) |
| 3 | Cron secrets sem timing-safe | ✅ Corrigida — `safe-equal.mjs` usado em ambos |
| 4 | CPF/CNPJ sem dígito verificador | ✅ Corrigida — `isValidCpfCnpj` + testes |
| 5 | `DEFAULT_SUPER_ADMIN_EMAIL` hardcoded | 🟡 Parcial — env lido primeiro, hardcode segue como fallback (`super-admin.mjs:7-10`) |
| 6 | `contarDiasUteis` conta dia da aquisição | ✅ Corrigida — D+1 explícito (`investimentos-rendimento.mjs:87-91`) |
| 7 | IR múltiplos aportes alíquota errada | ✅ Corrigida — alíquota ponderada (`:198-201`) |
| 8 | Parcelas pendentes em UTC | ✅ Corrigida — `fimDoDiaBrtIso()` |
| 9 | Alertas financeiros mês UTC | ✅ Corrigida — `partesBrt()` |
| 10 | WhatsApp bot data UTC | ✅ Corrigida — `hojeYmdBrt()` meio-dia BRT |
| 11 | Gaps de teste em lógica de dinheiro | 🟡 Parcial — rendimento ✅, bot-data ✅; **faltam `parcelas-pendentes` e `import-service`** |
| 12 | `formatCurrencyBRL` duplicado | ✅ Corrigida |
| 13 | Modais sem `useModalA11y` (Listas/Cartões) | ✅ Corrigida — `ListaModais.jsx` (6×) + `ModalFatura` |
| 14 | `useVirtualizer count:0` morto | ✅ Corrigida — removido |
| 15 | `ListaDeCompras.jsx` gigante | 🟡 Melhorou — 2.487 → 1.239 linhas (modais extraídos), ainda monolítico |

**Saldo:** 11 corrigidas, 3 parciais, 0 regressões detectadas.

---

## Recomendação de priorização

**✅ Aplicado em 10/jun (mesma sessão):** itens 1, 2, 3, 4, 5 e 7. Item 6 verificado como falso-positivo. Validação: lint 0 erros, 318 testes passam, build ok.

**⚠️ Pré-requisito de deploy:** setar `PASSWORD_OTP_PEPPER` (string aleatória longa) no `.env` da VPS antes de subir — ver item 5.

**Próxima sprint:** 8 (PwaInstallPrompt Chrome iOS) e os 2 testes faltantes (`parcelas-pendentes`, `import-service`).

**Backlog:** 9-14 + refatoração contínua de `ListaDeCompras.jsx`.

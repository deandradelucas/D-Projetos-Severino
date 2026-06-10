# HANDOFF → @devops (Gage) — Deploy release/1.0.4

**De:** sessão de UI/UX + features (10-jun-2026)
**Branch:** `release/1.0.4` (trabalho local, **sem push** — push é exclusivo do @devops)
**Status DoD:** ✅ `npm test` (test:unit + lint + build) **PASSOU** — 314 testes ok, lint só com 1 warning pré-existente em `Transacoes.jsx:499` (não relacionado), build ok.

---

## ⚠️ ANTES de deployar — 2 coisas fora do código

1. **Migration `73_webauthn_friendly_name.sql` — JÁ APLICADA no Supabase.**
   - Banco `zesyderishnbjrpfbmqa` (Horizonte_Financeiro, é o mesmo de prod). Coluna `webauthn_credentials.friendly_name text` já existe.
   - **NÃO precisa rodar migration no deploy.** Arquivo versionado só pra histórico.

2. **SMTP na VPS (envio de e-mail / OTP) — PENDENTE, fazer no `.env` da VPS.**
   - O envio de e-mail é SMTP Hostinger (não Resend — `RESEND_*` foram removidas por mortas).
   - Rodar **no terminal da VPS** (`/home/lucas/severino`), **digitando a senha lá** (não está no repo):
     ```bash
     cd /home/lucas/severino
     printf '\nSMTP_HOST=smtp.hostinger.com\nSMTP_PORT=465\nSMTP_USER=mestredamente@mestredamente.com\nSMTP_PASS=SUA_SENHA_AQUI\nSMTP_FROM=Severino <mestredamente@mestredamente.com>\n' >> .env
     ```
   - Senha da caixa: 1Password / com o CEO. Sem isso, OTP de e-mail (cadastro + verificação) cai em 503.

---

## O que muda (28 arquivos, +1153/−645)

### Frontend — telas/UX
- **Pagamento** (`Pagamento.jsx`, `pagamento.css`): densidade, "Sua assinatura"/Histórico em cards, oferta (planos + value stack) lado a lado no desktop com preços em coluna, ícone **Pix oficial**, status chip colorido por tom, checkout em 2 colunas, hero mobile na mesma linha.
- **Configurações** (`Configuracoes.jsx` + `configuracoes.css` + cards): fix de overflow mobile (`minmax(0,1fr)`), polish Conta/Família/Segurança/Privacidade, **toggle de tema sol/lua**, **scroll-spy + filtro fixo**, **links Política/Termos**, **"Membro desde"**, ícones nas pílulas, skeleton biometria, confirmação por digitação ("APAGAR") no apagar-transações.
- **Tema automático** (`ThemeContext.jsx` + `ConfigAparenciaCard.jsx`): preferência `system` (segue `prefers-color-scheme`).
- **Dashboard** (`Dashboard.jsx`, `dashboard.css`): cards do "Severino IA" não empurram mais o "Próximo compromisso" (grid `minmax(0,...)`), **rolagem lateral por roda do mouse + setas ‹ ›** sem barra; **removido** o tutorial de onboarding (spotlight) — arquivos `onboarding/TutorialDashboard.jsx` e `tutorialDashboardState.js` deletados.
- **Layout shell** (`shell.css`): **sidebar desktop fixa** (`flex:none` honra `height:100vh` — antes a janela rolava junto). (`from-index.css`): páginas legais (Política/Termos) **rolam** (antes clipadas pelo `overflow:hidden` do shell).
- **PWA prompt** (`PwaInstallPrompt.jsx` + `.css`): **import de CSS que estava faltando** (renderizava cru) + **variante iOS** (instruções "Adicionar à Tela de Início") + só aparece após 1 min + para após 5 "agora não" + benefício "Funciona offline" + escondido em login/cadastro/boas-vindas/trial-expirado/pagamento.
- **Boas-vindas** (`BemVindoAssinatura.jsx` + `.css`): responsivo (cabe no mobile, maior no desktop) + **preço** (do catálogo) + "Começar a usar agora" como botão secundário.
- **Trial expirado** (`TrialExpirado.jsx` + `.css`): responsivo + preço + **"Já assinei" revalida o status** (não vai mais pro checkout → evita confusão/cobrança dupla).
- **ConfirmDialog** (`ConfirmDialog.jsx` + `confirm-dialog.css`): nova prop `requireText` (confirmação por digitação, reutilizável).

### Backend (`server/`) — exige restart do PM2
- `routes/register-usuario-perfil.mjs`: **+5 endpoints** — `POST /api/usuarios/perfil/{email,telefone}/{enviar-otp,verificar}` (verificação logada, reusa libs do cadastro) e `POST /api/usuarios/perfil/senha` (alterar senha: valida atual via bcrypt + grava nova).
- `lib/webauthn.mjs`: `deviceLabelFromUA()` + grava `friendly_name` no registro de biometria + retorna na listagem.
- `lib/familiaUi.js`: `papelConviteDesc()` (labels de papel curtos + descrição).
- **Novo teste:** `server/tests/webauthn-device-label.test.mjs` (5 casos, passando).

### NÃO commitar (ruído local)
- `.claude/settings.local.json` (config local) e `segunda-feira` (ponteiro de submódulo) aparecem no status — **excluir dos commits de deploy**.
- `.env` local tem o SMTP (gitignored — não entra no repo, correto).

---

## Commits sugeridos (atômicos, conventional)
1. `feat(pagamento): densidade, oferta 2-col, ícone Pix oficial, status chip, checkout responsivo`
2. `feat(config): verificação e-mail/telefone (OTP), alterar senha no app, tema automático`
3. `feat(config): scroll-spy + filtro fixo, links legais, membro desde, ícones, confirmação digitada`
4. `feat(api): endpoints de verificação OTP + alterar senha; biometria friendly_name (+migration 73)`
5. `fix(dashboard): IA não empurra agenda + scroll lateral (roda/setas); remove tutorial onboarding`
6. `fix(layout): sidebar desktop fixa (flex:none) + scroll das páginas legais`
7. `fix(pwa): restaura CSS do convite + variante iOS, timing 1min, dismiss x5, rotas ocultas`
8. `feat(onboarding): boas-vindas e trial-expirado responsivos + preço; "Já assinei" revalida`

*(Pode agrupar mais se preferir — o conjunto é coeso por release.)*

---

## Runbook de deploy (VPS — ver também project-deploy.md)
> VPS está em **`release/1.0.3`** → precisa mudar pra `release/1.0.4`. Frontend **e** backend mudaram → build + restart.

```bash
# 1. (local, @devops) push
git push origin release/1.0.4

# 2. SSH na VPS (paramiko — ver project-deploy.md)
cd /home/lucas/severino
git checkout -- package-lock.json            # evita conflito de drift do lockfile
git fetch origin release/1.0.4
git checkout -B release/1.0.4 origin/release/1.0.4
npm install --legacy-peer-deps --silent      # deps podem ter mudado
npx vite build                               # NÃO usar `npm run build` (vite pode não estar no PATH)
# (SMTP: adicionar bloco no .env ANTES do restart — ver seção acima)
pm2 restart severino --update-env
```

## Validação pós-deploy
- `curl -s http://localhost:3001/api/health`
- Login funciona (API no ar).
- Tela de **Configurações**: "Verificar agora" no e-mail dispara OTP real (precisa do SMTP setado).
- **Biometria**: testar em device real HTTPS (registro grava `friendly_name`).
- **Trial expirado**: "Já assinei" revalida e libera (não vai pro checkout).
- Dashboard desktop: sidebar fixa ao rolar; cards IA rolam pro lado.

## Rollback
- `git checkout -B release/1.0.3 origin/release/1.0.3 && npx vite build && pm2 restart severino`
- Migration 73 é aditiva (coluna nullable) — **não precisa reverter**.

---

**Notas de segurança:** nenhum segredo no repo. SMTP só no `.env` (VPS + local, gitignored). Senha da caixa via 1Password.

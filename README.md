# Horizonte Financeiro

Aplicacao React + Vite com autenticacao simples em Supabase, redefinicao de senha por e-mail e rotas server-side para operacoes administrativas.

## Backup no Google Drive

O projeto agora possui backup server-side da tabela `usuarios` para um arquivo JSON no Google Drive.

### Variaveis necessarias

Adicione no ambiente:

- `GOOGLE_DRIVE_CLIENT_EMAIL`
- `GOOGLE_DRIVE_PRIVATE_KEY`
- `GOOGLE_DRIVE_FOLDER_ID`
- `BACKUP_SECRET`

Observacao:
- compartilhe a pasta do Google Drive com o e-mail da service account
- em `GOOGLE_DRIVE_PRIVATE_KEY`, mantenha as quebras como `\n` no `.env`

### Executar manualmente

```bash
npm run backup:drive
```

### Executar via API

Endpoint:

```bash
POST /api/admin/run-backup
```

Header obrigatorio:

```bash
x-backup-secret: <BACKUP_SECRET>
```

# Horizonte Financeiro

Aplicacao React + Vite com autenticacao simples em Supabase, redefinicao de senha por e-mail e rotas server-side para operacoes administrativas.

## Backup com rclone

Para executar o backup manual para o Google Drive via `rclone`, rode:

```bash
npm run backup:rclone
```

Destino padrao:

```text
gdrive-backup:Backup - Horizonte Financeiro
```

Variaveis opcionais:

- `RCLONE_REMOTE` para trocar o nome do remote
- `RCLONE_DEST_PATH` para trocar a pasta de destino no Drive
- `SUPABASE_BACKUP_TABLES` para definir as tabelas do Supabase que entram no snapshot JSON

Estrutura do pacote:

- `supabase/supabase-data.json` com o snapshot das tabelas do Supabase
- `project-files/` com os arquivos do projeto

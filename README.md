# Horizonte Financeiro

Aplicacao React + Vite com autenticacao simples em Supabase, redefinicao de senha por e-mail e rotas server-side para operacoes administrativas.

## Backup com rclone

Para executar o backup manual para o Google Drive via `rclone`, rode:

```bash
npm run backup:rclone
```

Para instalar uma tarefa automatica no Windows Task Scheduler:

```bash
npm run backup:rclone:task
```

Horario padrao da tarefa:

```text
02:00
```

Destino padrao:

```text
gdrive-backup:Backup - Horizonte Financeiro
```

Variaveis opcionais:

- `RCLONE_REMOTE` para trocar o nome do remote
- `RCLONE_DEST_PATH` para trocar a pasta de destino no Drive
- `SUPABASE_BACKUP_TABLES` para definir as tabelas do Supabase que entram no snapshot JSON
- `SUPABASE_DB_URL` ou `DATABASE_URL` para gerar tambem um dump SQL completo via `pg_dump`
- ou, em vez da URL, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` e `PGDATABASE`

Estrutura do pacote:

- `supabase/supabase-data.json` com o snapshot das tabelas do Supabase
- `supabase/<timestamp>.sql` com dump SQL completo, quando a conexao Postgres estiver configurada
- `project-files/` com os arquivos do projeto

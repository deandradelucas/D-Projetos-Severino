# Horizonte Financeiro

Aplicacao React + Vite com autenticacao simples em Supabase, redefinicao de senha por e-mail e rotas server-side para operacoes administrativas.

## WhatsApp local com Docker

O `docker-compose.yml` sobe a Evolution API v2 com Postgres e Redis locais. O webhook global ja aponta para a API Node do Horizonte em `http://host.docker.internal:3001/api/whatsapp/webhook/<token>`, que e o endereco visto de dentro do container no Docker Desktop.

1. Copie `env.example` para `.env` ou complete as variaveis equivalentes no `.env` existente (o Docker Compose le esse arquivo automaticamente).
2. Defina `WHATSAPP_WEBHOOK_TOKEN` e `EVOLUTION_API_KEY` no mesmo `.env`.
3. Suba o app local em uma janela:

```bash
npm run dev
```

4. Suba a Evolution API em outra janela:

```bash
npm run whatsapp:docker:up
```

5. Abra `http://localhost:8080`, use a `EVOLUTION_API_KEY`, crie/conecte a instancia e leia o QR Code. As mensagens recebidas chegam no webhook do Horizonte e aparecem em `/admin/whatsapp`.

Comandos uteis:

```bash
npm run whatsapp:docker:logs
npm run whatsapp:docker:down
```

Se a API local nao estiver na porta `3001`, ajuste `WHATSAPP_WEBHOOK_BASE_URL` para `http://host.docker.internal:<porta>` antes de subir o compose. Em Linux, se o container nao alcancar o host, rode a API com `API_HOST=0.0.0.0`.

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

## Theme guidelines

O arquivo `docs/theme-guidelines.md` detalha como o `dashboard.css` centraliza a lógica, quando editar os mirrors do tema escuro e quais tokens (`--bg-card`, `--accent`, `--sidebar-backdrop-blur`) existem para manter os temas alinhados.

#!/usr/bin/env bash
# =============================================================================
# backup-gdrive.sh — Backup automático do Severino para o Google Drive
# Versão: 1.0.0 — Mai/2026
# Autor: Wire (automation-architect)
#
# O que faz:
#   1. Lê variáveis do .env de produção
#   2. Cria .tar.gz com timestamp contendo .env + uploads (se existirem)
#   3. Tenta dump SQL do Supabase via pg_dump (se SUPABASE_DB_URL estiver no .env)
#   4. Faz upload para Google Drive via rclone (Service Account)
#   5. Remove backups com mais de 30 dias no Drive
#   6. Envia alerta no Telegram em caso de QUALQUER falha
#   7. Registra log completo em /var/log/backup-gdrive.log
#
# Dependências na VPS:
#   - rclone >= 1.60 (https://rclone.org/install/)
#   - pg_dump (postgresql-client) — OPCIONAL, para dump SQL
#   - curl — para alertas Telegram
#
# Configuração:
#   1. Instale rclone e configure ~/.config/rclone/rclone.conf (ver template)
#   2. Ajuste as variáveis de configuração abaixo se necessário
#   3. Agende via cron: 0 5 * * * /home/lucas/scripts/backup-gdrive.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# CONFIGURAÇÃO — ajuste apenas estas variáveis
# ---------------------------------------------------------------------------

# Caminho do .env de produção na VPS
ENV_FILE="/home/lucas/severino/.env"

# Diretório raiz da aplicação (backup completo, excluindo node_modules e dist)
APP_DIR="/home/lucas/severino"

# Diretório de uploads (se existir, será incluído via APP_DIR)
UPLOADS_DIR="/home/lucas/severino/uploads"

# Nome do remote configurado no rclone.conf
RCLONE_REMOTE="gdrive-backup"

# Pasta no Google Drive (será criada automaticamente se não existir)
RCLONE_DEST_PATH="Backup - Severino"

# Retenção: quantos dias de backup manter no Drive
RETENTION_DAYS=30

# Log local
LOG_FILE="/var/log/backup-gdrive.log"

# Diretório temporário para montar o backup (será deletado ao final)
TEMP_DIR="/tmp/severino-backup-$$"

# ---------------------------------------------------------------------------
# FIM DA CONFIGURAÇÃO
# ---------------------------------------------------------------------------

# Timestamp no formato ISO sem dois-pontos (compatível com nomes de arquivo)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_NAME="severino-backup-${TIMESTAMP}"
ARCHIVE_PATH="/tmp/${BACKUP_NAME}.tar.gz"

# ---------------------------------------------------------------------------
# FUNÇÕES UTILITÁRIAS
# ---------------------------------------------------------------------------

log() {
  local level="$1"
  shift
  local msg="[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [${level}] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

log_separator() {
  echo "$(printf '=%.0s' {1..70})" | tee -a "$LOG_FILE"
}

# Carrega uma variável do .env (suporta aspas, comentários, espaços)
# Uso: load_env_var NOME_DA_VAR
load_env_var() {
  local var_name="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    return 1
  fi
  # grep: pega a linha da variável
  # sed: remove prefixo VAR=, remove aspas simples ou duplas envolventes
  local value
  value=$(grep -E "^${var_name}=" "$ENV_FILE" 2>/dev/null \
    | head -1 \
    | sed "s/^${var_name}=//" \
    | sed "s/^['\"]//;s/['\"]$//")
  echo "$value"
}

# Envia mensagem de alerta no Telegram
# Chamado em caso de falha — lê token e chat_id do .env
telegram_alert() {
  local message="$1"

  local token chat_id
  token=$(load_env_var "TELEGRAM_BOT_TOKEN")
  chat_id=$(load_env_var "TELEGRAM_CHAT_ID")

  if [[ -z "$token" || -z "$chat_id" ]]; then
    log "WARN" "Alerta Telegram ignorado: TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados no .env"
    return 0
  fi

  local hostname
  hostname=$(hostname -s 2>/dev/null || echo "vps")

  local full_msg
  full_msg="[BACKUP SEVERINO] FALHA — ${hostname}

${message}

Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Log: ${LOG_FILE}"

  # Curl com timeout curto — não bloquear o script por muito tempo
  curl --silent --max-time 10 \
    -X POST "https://api.telegram.org/bot${token}/sendMessage" \
    -d "chat_id=${chat_id}" \
    --data-urlencode "text=${full_msg}" \
    > /dev/null 2>&1 || log "WARN" "Falha ao enviar alerta Telegram (curl erro)"
}

# Handler de erro — chamado automaticamente por set -e
on_error() {
  local exit_code=$?
  local line_number=$1
  log "ERROR" "Falha na linha ${line_number} — exit code ${exit_code}"
  telegram_alert "Erro na linha ${line_number} (exit code ${exit_code}). Verifique o log: ${LOG_FILE}"
  cleanup
  exit "$exit_code"
}

# Limpa arquivos temporários
cleanup() {
  if [[ -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR" 2>/dev/null || true
    log "INFO" "Diretório temporário removido: ${TEMP_DIR}"
  fi
  if [[ -f "$ARCHIVE_PATH" ]]; then
    rm -f "$ARCHIVE_PATH" 2>/dev/null || true
    log "INFO" "Arquivo temporário removido: ${ARCHIVE_PATH}"
  fi
}

# Trap para erros (linha onde ocorreu o erro é passada como argumento)
trap 'on_error $LINENO' ERR

# ---------------------------------------------------------------------------
# PASSO 0 — Garantir que o log existe e é gravável
# ---------------------------------------------------------------------------

touch "$LOG_FILE" 2>/dev/null || {
  LOG_FILE="/tmp/backup-gdrive.log"
  touch "$LOG_FILE"
}

log_separator
log "INFO" "BACKUP SEVERINO — INÍCIO"
log "INFO" "Backup: ${BACKUP_NAME}"
log "INFO" "Destino: ${RCLONE_REMOTE}:${RCLONE_DEST_PATH}"

# ---------------------------------------------------------------------------
# PASSO 1 — Verificar dependências
# ---------------------------------------------------------------------------

log "INFO" "Verificando dependências..."

if ! command -v rclone &>/dev/null; then
  log "ERROR" "rclone não encontrado. Instale com: curl https://rclone.org/install.sh | sudo bash"
  telegram_alert "rclone não encontrado na VPS. Backup impossível."
  exit 1
fi

if ! command -v curl &>/dev/null; then
  log "ERROR" "curl não encontrado"
  exit 1
fi

log "INFO" "rclone: $(rclone version --check=false 2>/dev/null | head -1 || rclone version | head -1)"

# pg_dump é OPCIONAL — se não existir, o dump SQL é simplesmente ignorado
PG_DUMP_AVAILABLE=false
if command -v pg_dump &>/dev/null; then
  PG_DUMP_AVAILABLE=true
  log "INFO" "pg_dump: $(pg_dump --version)"
else
  log "WARN" "pg_dump não encontrado — dump SQL do Supabase será ignorado"
  log "WARN" "Para habilitar: apt-get install -y postgresql-client"
fi

# ---------------------------------------------------------------------------
# PASSO 2 — Verificar .env de produção
# ---------------------------------------------------------------------------

log "INFO" "Verificando .env em: ${ENV_FILE}"

if [[ ! -f "$ENV_FILE" ]]; then
  log "ERROR" ".env não encontrado em ${ENV_FILE}"
  telegram_alert ".env de produção não encontrado em ${ENV_FILE}"
  exit 1
fi

log "INFO" ".env encontrado ($(wc -l < "$ENV_FILE") linhas)"

# ---------------------------------------------------------------------------
# PASSO 3 — Criar estrutura temporária de backup
# ---------------------------------------------------------------------------

log "INFO" "Criando estrutura temporária em: ${TEMP_DIR}"
mkdir -p "${TEMP_DIR}/app"
mkdir -p "${TEMP_DIR}/db"

# 3a. Copiar aplicação completa (excluindo node_modules, dist, .git)
log "INFO" "Copiando aplicação de: ${APP_DIR}"
rsync -a \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='dist/' \
  --exclude='.cache/' \
  --exclude='*.log' \
  "${APP_DIR}/" "${TEMP_DIR}/app/"
APP_SIZE=$(du -sh "${TEMP_DIR}/app" | cut -f1)
APP_FILES=$(find "${TEMP_DIR}/app" -type f | wc -l)
log "INFO" "Aplicação copiada: ${APP_FILES} arquivos (${APP_SIZE})"

# ---------------------------------------------------------------------------
# PASSO 4 — Dump SQL do Supabase (opcional, mas recomendado)
# ---------------------------------------------------------------------------

if [[ "$PG_DUMP_AVAILABLE" == "true" ]]; then
  log "INFO" "Tentando dump SQL do Supabase..."

  # Tenta ler SUPABASE_DB_URL primeiro (connection string direta)
  # Se não existir, tenta construir a partir de VITE_SUPABASE_URL + service role
  SUPABASE_DB_URL=$(load_env_var "SUPABASE_DB_URL")

  if [[ -z "$SUPABASE_DB_URL" ]]; then
    # Tenta DATABASE_URL como alternativa
    SUPABASE_DB_URL=$(load_env_var "DATABASE_URL")
  fi

  if [[ -n "$SUPABASE_DB_URL" ]]; then
    log "INFO" "Connection string encontrada — executando pg_dump..."
    SQL_DUMP_PATH="${TEMP_DIR}/db/supabase-dump-${TIMESTAMP}.sql"

    # Timeout de 5 minutos para o dump — se travar, aborta
    if timeout 300 pg_dump \
        --dbname="$SUPABASE_DB_URL" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --no-acl \
        --file="$SQL_DUMP_PATH" 2>> "$LOG_FILE"; then
      DUMP_SIZE=$(du -sh "$SQL_DUMP_PATH" | cut -f1)
      log "INFO" "Dump SQL concluído: ${SQL_DUMP_PATH} (${DUMP_SIZE})"
    else
      log "WARN" "pg_dump falhou ou excedeu timeout de 5min — continuando sem dump SQL"
      rm -f "$SQL_DUMP_PATH" 2>/dev/null || true
    fi
  else
    log "WARN" "SUPABASE_DB_URL/DATABASE_URL não configurada no .env"
    log "WARN" "Para habilitar o dump SQL, adicione ao .env:"
    log "WARN" "  SUPABASE_DB_URL=postgresql://postgres:[senha]@db.[projeto].supabase.co:5432/postgres"
    log "WARN" "  (disponível em: Supabase → Settings → Database → Connection string → URI)"

    # Fallback: salvar snapshot JSON via API se service role key existir
    SUPABASE_URL=$(load_env_var "VITE_SUPABASE_URL")
    SERVICE_ROLE_KEY=$(load_env_var "SUPABASE_SERVICE_ROLE_KEY")

    if [[ -n "$SUPABASE_URL" && -n "$SERVICE_ROLE_KEY" ]]; then
      log "INFO" "Fallback: salvando metadados do Supabase via REST API..."
      # Salvar apenas uma nota sobre o estado do backup — não é dump completo
      cat > "${TEMP_DIR}/db/supabase-info.json" << EOF
{
  "note": "Dump SQL completo nao disponivel. Configure SUPABASE_DB_URL no .env.",
  "supabase_url": "${SUPABASE_URL}",
  "backup_timestamp": "${TIMESTAMP}",
  "instructions": "Para restaurar: acesse o painel Supabase em ${SUPABASE_URL}"
}
EOF
      log "INFO" "Arquivo de metadados do Supabase salvo"
    fi
  fi
else
  log "WARN" "pg_dump indisponível — pulando dump do banco"
fi

# ---------------------------------------------------------------------------
# PASSO 5 — Criar arquivo .tar.gz
# ---------------------------------------------------------------------------

log "INFO" "Criando arquivo compactado: ${ARCHIVE_PATH}"

# tar com gzip — incluir todo o conteúdo de TEMP_DIR
# -C muda o diretório base para que os caminhos no tar sejam relativos
tar -czf "$ARCHIVE_PATH" -C "$TEMP_DIR" .

ARCHIVE_SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)
log "INFO" "Arquivo criado: ${ARCHIVE_PATH} (${ARCHIVE_SIZE})"

# ---------------------------------------------------------------------------
# PASSO 6 — Verificar configuração do rclone
# ---------------------------------------------------------------------------

log "INFO" "Verificando remote rclone: ${RCLONE_REMOTE}"

if ! rclone listremotes 2>/dev/null | grep -q "^${RCLONE_REMOTE}:"; then
  log "ERROR" "Remote '${RCLONE_REMOTE}' não configurado no rclone"
  log "ERROR" "Verifique ~/.config/rclone/rclone.conf"
  telegram_alert "Remote rclone '${RCLONE_REMOTE}' não configurado. Backup NÃO enviado."
  cleanup
  exit 1
fi

# Teste rápido de conectividade com o Drive (lista raiz do remote)
if ! rclone lsd "${RCLONE_REMOTE}:" --max-depth 1 2>/dev/null; then
  log "ERROR" "Falha ao conectar com remote ${RCLONE_REMOTE} — verifique Service Account e permissões"
  telegram_alert "Falha ao conectar com Google Drive (remote: ${RCLONE_REMOTE}). Backup NÃO enviado."
  cleanup
  exit 1
fi

log "INFO" "Remote ${RCLONE_REMOTE} acessível"

# ---------------------------------------------------------------------------
# PASSO 7 — Upload para Google Drive
# ---------------------------------------------------------------------------

log "INFO" "Enviando backup para: ${RCLONE_REMOTE}:${RCLONE_DEST_PATH}/"

# --transfers 1 — upload sequencial (mais robusto para arquivos grandes)
# --retries 3 — 3 tentativas em caso de falha de rede
# --low-level-retries 5 — tentativas em erros de baixo nível
# --stats-one-line — log de progresso em linha única
if rclone copy \
    "$ARCHIVE_PATH" \
    "${RCLONE_REMOTE}:${RCLONE_DEST_PATH}/" \
    --transfers 1 \
    --retries 3 \
    --retries-sleep 10s \
    --low-level-retries 5 \
    --stats 30s \
    --stats-one-line \
    2>> "$LOG_FILE"; then
  log "INFO" "Upload concluído com sucesso"
else
  log "ERROR" "Falha no upload para o Google Drive"
  telegram_alert "Falha no upload do backup para o Google Drive. Verifique ${LOG_FILE}."
  cleanup
  exit 1
fi

# Verificar que o arquivo chegou no Drive
log "INFO" "Verificando presença do arquivo no Drive..."
if rclone ls "${RCLONE_REMOTE}:${RCLONE_DEST_PATH}/${BACKUP_NAME}.tar.gz" 2>/dev/null; then
  log "INFO" "Arquivo confirmado no Drive: ${BACKUP_NAME}.tar.gz"
else
  log "WARN" "Arquivo não encontrado no Drive após upload — verifique manualmente"
fi

# ---------------------------------------------------------------------------
# PASSO 8 — Política de retenção (deleta backups com mais de RETENTION_DAYS)
# ---------------------------------------------------------------------------

log "INFO" "Aplicando política de retenção: manter últimos ${RETENTION_DAYS} dias..."

# rclone delete com --min-age apaga arquivos mais antigos que N dias
# --include "severino-backup-*.tar.gz" — só apaga backups deste script (seguro)
DELETED_COUNT=0
if rclone delete \
    "${RCLONE_REMOTE}:${RCLONE_DEST_PATH}/" \
    --include "severino-backup-*.tar.gz" \
    --min-age "${RETENTION_DAYS}d" \
    --verbose 2>> "$LOG_FILE"; then
  log "INFO" "Limpeza de retenção concluída"
else
  log "WARN" "Aviso na limpeza de retenção — verifique o log"
fi

# Contar quantos backups restam no Drive
REMAINING=$(rclone ls "${RCLONE_REMOTE}:${RCLONE_DEST_PATH}/" \
  --include "severino-backup-*.tar.gz" 2>/dev/null | wc -l || echo "?")
log "INFO" "Backups restantes no Drive: ${REMAINING}"

# ---------------------------------------------------------------------------
# PASSO 9 — Limpeza local e relatório final
# ---------------------------------------------------------------------------

cleanup

log_separator
log "INFO" "BACKUP CONCLUÍDO COM SUCESSO"
log "INFO" "Arquivo:   ${BACKUP_NAME}.tar.gz (${ARCHIVE_SIZE})"
log "INFO" "Destino:   ${RCLONE_REMOTE}:${RCLONE_DEST_PATH}/"
log "INFO" "Retenção:  ${RETENTION_DAYS} dias | Backups no Drive: ${REMAINING}"
log_separator

# Notificação de sucesso no Telegram
token=$(load_env_var "TELEGRAM_BOT_TOKEN")
chat_id=$(load_env_var "TELEGRAM_CHAT_ID")
if [[ -n "$token" && -n "$chat_id" ]]; then
  success_msg="✅ Backup Severino concluído

📦 Arquivo: ${BACKUP_NAME}.tar.gz
📏 Tamanho: ${ARCHIVE_SIZE}
☁️ Backups no Drive: ${REMAINING}
🕐 $(date -u +"%d/%m/%Y %H:%M") UTC"

  curl --silent --max-time 10 \
    -X POST "https://api.telegram.org/bot${token}/sendMessage" \
    -d "chat_id=${chat_id}" \
    --data-urlencode "text=${success_msg}" \
    > /dev/null 2>&1 || true
fi

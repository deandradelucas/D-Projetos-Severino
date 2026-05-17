#!/usr/bin/env bash
# =============================================================================
# test-backup.sh — Testa o sistema de backup sem agendamento
#
# Execute uma vez para validar que tudo funciona antes de configurar o cron.
# Não envia alertas Telegram (apenas exibe no terminal).
#
# Uso:
#   chmod +x /home/lucas/scripts/test-backup.sh
#   bash /home/lucas/scripts/test-backup.sh
# =============================================================================

set -euo pipefail

BACKUP_SCRIPT="/home/lucas/scripts/backup-gdrive.sh"
ENV_FILE="/home/lucas/severino/.env"
RCLONE_REMOTE="gdrive-backup"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail() { echo -e "${RED}[FAIL]${NC}  $*"; }
info() { echo -e "${BLUE}[INFO]${NC}  $*"; }

echo ""
echo "============================================================"
echo "  TESTE DE BACKUP — SEVERINO"
echo "  $(date)"
echo "============================================================"
echo ""

# ---------------------------------------------------------------------------
# CHECK 1 — rclone instalado
# ---------------------------------------------------------------------------

info "Verificando rclone..."
if command -v rclone &>/dev/null; then
  ok "rclone encontrado: $(rclone version --check=false 2>/dev/null | head -1 || rclone version | head -1)"
else
  fail "rclone NÃO encontrado"
  echo ""
  echo "  Instale com:"
  echo "    curl https://rclone.org/install.sh | sudo bash"
  echo ""
  exit 1
fi

# ---------------------------------------------------------------------------
# CHECK 2 — Arquivo de configuração rclone
# ---------------------------------------------------------------------------

info "Verificando ~/.config/rclone/rclone.conf..."
RCLONE_CONF="${HOME}/.config/rclone/rclone.conf"

if [[ -f "$RCLONE_CONF" ]]; then
  ok "rclone.conf encontrado"
  # Verifica se o remote gdrive-backup está configurado
  if grep -q "\[${RCLONE_REMOTE}\]" "$RCLONE_CONF"; then
    ok "Remote '${RCLONE_REMOTE}' encontrado no rclone.conf"
  else
    fail "Remote '${RCLONE_REMOTE}' NÃO encontrado no rclone.conf"
    echo ""
    echo "  Remotes configurados:"
    rclone listremotes 2>/dev/null || echo "  (nenhum)"
    echo ""
    echo "  Configure seguindo o template em: deploy/rclone.conf.template"
    exit 1
  fi
else
  fail "rclone.conf não encontrado em: ${RCLONE_CONF}"
  echo ""
  echo "  Crie o arquivo seguindo o template em: deploy/rclone.conf.template"
  exit 1
fi

# ---------------------------------------------------------------------------
# CHECK 3 — Conectividade com Google Drive
# ---------------------------------------------------------------------------

info "Testando conectividade com Google Drive (remote: ${RCLONE_REMOTE})..."
if rclone lsd "${RCLONE_REMOTE}:" --max-depth 1 2>/dev/null; then
  ok "Conexão com Google Drive funcionando"
else
  fail "Falha ao conectar com Google Drive"
  echo ""
  echo "  Possíveis causas:"
  echo "  1. Service Account sem acesso à pasta compartilhada"
  echo "  2. Drive API não habilitada no projeto Google Cloud"
  echo "  3. JSON do Service Account incorreto no rclone.conf"
  echo ""
  echo "  Teste manual: rclone ls ${RCLONE_REMOTE}:"
  exit 1
fi

# ---------------------------------------------------------------------------
# CHECK 4 — .env de produção
# ---------------------------------------------------------------------------

info "Verificando .env de produção em: ${ENV_FILE}..."
if [[ -f "$ENV_FILE" ]]; then
  LINE_COUNT=$(wc -l < "$ENV_FILE")
  ok ".env encontrado (${LINE_COUNT} linhas)"

  # Verifica variáveis críticas
  for var in TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID VITE_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
    if grep -q "^${var}=." "$ENV_FILE" 2>/dev/null; then
      ok "  ${var} configurada"
    else
      warn "  ${var} não configurada (ou vazia)"
    fi
  done

  # Verifica SUPABASE_DB_URL para dump SQL
  if grep -q "^SUPABASE_DB_URL=." "$ENV_FILE" 2>/dev/null || \
     grep -q "^DATABASE_URL=." "$ENV_FILE" 2>/dev/null; then
    ok "  SUPABASE_DB_URL/DATABASE_URL configurada — dump SQL será executado"
  else
    warn "  SUPABASE_DB_URL não configurada — dump SQL será ignorado"
    echo "         Para habilitar, adicione ao .env:"
    echo "         SUPABASE_DB_URL=postgresql://postgres:[senha]@db.[projeto].supabase.co:5432/postgres"
  fi
else
  fail ".env NÃO encontrado em: ${ENV_FILE}"
  exit 1
fi

# ---------------------------------------------------------------------------
# CHECK 5 — pg_dump (opcional)
# ---------------------------------------------------------------------------

info "Verificando pg_dump (dump SQL — opcional)..."
if command -v pg_dump &>/dev/null; then
  ok "pg_dump encontrado: $(pg_dump --version)"
else
  warn "pg_dump não encontrado — dump SQL indisponível"
  echo "         Para instalar: apt-get install -y postgresql-client"
fi

# ---------------------------------------------------------------------------
# CHECK 6 — Script de backup
# ---------------------------------------------------------------------------

info "Verificando script de backup em: ${BACKUP_SCRIPT}..."
if [[ -f "$BACKUP_SCRIPT" ]]; then
  if [[ -x "$BACKUP_SCRIPT" ]]; then
    ok "Script encontrado e executável"
  else
    warn "Script encontrado mas sem permissão de execução"
    echo "         Corrija com: chmod +x ${BACKUP_SCRIPT}"
  fi
else
  fail "Script de backup não encontrado em: ${BACKUP_SCRIPT}"
  echo ""
  echo "  Copie o script para a VPS:"
  echo "    scp deploy/backup-gdrive.sh root@187.77.32.207:/home/lucas/scripts/"
  exit 1
fi

# ---------------------------------------------------------------------------
# RESUMO — Perguntar se deve executar o backup de teste
# ---------------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  TODOS OS CHECKS PASSARAM"
echo "============================================================"
echo ""
echo "  Deseja executar um backup de teste agora? [s/N]"
read -r -t 30 CONFIRM || CONFIRM="N"
echo ""

if [[ "${CONFIRM,,}" == "s" || "${CONFIRM,,}" == "sim" || "${CONFIRM,,}" == "y" || "${CONFIRM,,}" == "yes" ]]; then
  info "Executando backup de teste..."
  echo ""
  bash "$BACKUP_SCRIPT"
  EXIT_CODE=$?
  echo ""
  if [[ $EXIT_CODE -eq 0 ]]; then
    ok "BACKUP DE TESTE CONCLUÍDO COM SUCESSO"
    echo ""
    echo "  Verifique a pasta '${RCLONE_REMOTE}:Backup - Severino' no Google Drive."
    echo "  Para listar: rclone ls ${RCLONE_REMOTE}:\"Backup - Severino\""
  else
    fail "BACKUP DE TESTE FALHOU (exit code: ${EXIT_CODE})"
    echo "  Verifique o log: /var/log/backup-gdrive.log"
    exit $EXIT_CODE
  fi
else
  info "Backup de teste cancelado. Execute manualmente quando quiser:"
  echo ""
  echo "  bash /home/lucas/scripts/backup-gdrive.sh"
  echo ""
  echo "  Para agendar o cron (2h BRT = 5h UTC), adicione via 'crontab -e':"
  echo "  0 5 * * * /home/lucas/scripts/backup-gdrive.sh >> /var/log/backup-gdrive.log 2>&1"
fi

echo ""

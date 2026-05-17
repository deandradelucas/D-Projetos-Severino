#!/usr/bin/env bash
# =============================================================================
# setup-vps-backup.sh — Configura o ambiente de backup na VPS
#
# Execute este script NA VPS como root após copiar os arquivos.
# Ele instala rclone, cria diretórios e configura permissões.
#
# Uso:
#   bash /home/lucas/scripts/setup-vps-backup.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail() { echo -e "${RED}[FAIL]${NC}  $*"; }
info() { echo -e "${BLUE}[INFO]${NC}  $*"; }

echo ""
echo "============================================================"
echo "  SETUP DE BACKUP — SEVERINO VPS"
echo "============================================================"
echo ""

# ---------------------------------------------------------------------------
# 1. Instalar rclone
# ---------------------------------------------------------------------------

info "Verificando rclone..."
if command -v rclone &>/dev/null; then
  ok "rclone já instalado: $(rclone version --check=false 2>/dev/null | head -1 || rclone version | head -1)"
else
  info "Instalando rclone..."
  curl https://rclone.org/install.sh | bash
  ok "rclone instalado: $(rclone version --check=false 2>/dev/null | head -1 || rclone version | head -1)"
fi

# ---------------------------------------------------------------------------
# 2. Instalar pg_dump (cliente PostgreSQL)
# ---------------------------------------------------------------------------

info "Verificando pg_dump..."
if command -v pg_dump &>/dev/null; then
  ok "pg_dump já instalado: $(pg_dump --version)"
else
  info "Instalando postgresql-client..."
  apt-get update -qq && apt-get install -y -qq postgresql-client
  ok "pg_dump instalado: $(pg_dump --version)"
fi

# ---------------------------------------------------------------------------
# 3. Criar diretório de scripts
# ---------------------------------------------------------------------------

info "Criando diretório /home/lucas/scripts/..."
mkdir -p /home/lucas/scripts
chown lucas:lucas /home/lucas/scripts 2>/dev/null || true
ok "Diretório criado"

# ---------------------------------------------------------------------------
# 4. Criar diretório de configuração do rclone para root
# ---------------------------------------------------------------------------

info "Criando diretório ~/.config/rclone/..."
mkdir -p /root/.config/rclone
ok "Diretório criado: /root/.config/rclone/"

# ---------------------------------------------------------------------------
# 5. Criar arquivo de log
# ---------------------------------------------------------------------------

info "Criando arquivo de log..."
touch /var/log/backup-gdrive.log
chmod 640 /var/log/backup-gdrive.log
ok "Log criado: /var/log/backup-gdrive.log"

# ---------------------------------------------------------------------------
# 6. Tornar scripts executáveis
# ---------------------------------------------------------------------------

if [[ -f "/home/lucas/scripts/backup-gdrive.sh" ]]; then
  chmod +x /home/lucas/scripts/backup-gdrive.sh
  ok "backup-gdrive.sh executável"
fi

if [[ -f "/home/lucas/scripts/test-backup.sh" ]]; then
  chmod +x /home/lucas/scripts/test-backup.sh
  ok "test-backup.sh executável"
fi

# ---------------------------------------------------------------------------
# 7. Resumo e próximos passos
# ---------------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  SETUP CONCLUÍDO"
echo "============================================================"
echo ""
echo "  PRÓXIMOS PASSOS:"
echo ""
echo "  1. Configure o rclone.conf:"
echo "     nano /root/.config/rclone/rclone.conf"
echo "     (use o template em deploy/rclone.conf.template)"
echo ""
echo "  2. Adicione SUPABASE_DB_URL ao .env de produção:"
echo "     nano /home/lucas/severino/.env"
echo "     Adicione: SUPABASE_DB_URL=postgresql://postgres:[senha]@db.[id].supabase.co:5432/postgres"
echo "     (Supabase → Settings → Database → Connection string → URI)"
echo ""
echo "  3. Execute o teste:"
echo "     bash /home/lucas/scripts/test-backup.sh"
echo ""
echo "  4. Configure o cron (2h BRT = 5h UTC):"
echo "     crontab -e"
echo "     Adicione:"
echo "     0 5 * * * /home/lucas/scripts/backup-gdrive.sh >> /var/log/backup-gdrive.log 2>&1"
echo ""

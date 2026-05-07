#!/usr/bin/env bash
# Corre na VPS (Ubuntu/Debian), dentro do clone do repositório Severino:
#   chmod +x deploy/hostinger-vps/bootstrap-vps.sh
#   ./deploy/hostinger-vps/bootstrap-vps.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

echo "== Severino API — raiz do projeto: $ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "ERRO: Node não instalado. Instala Node 20+ (ex.: NodeSource 22.x) e volta a correr este script."
  exit 1
fi

NODE_VER="$(node -p "process.versions.node")"
echo "== Node: $NODE_VER"

if [[ ! -f .env ]]; then
  echo "AVISO: não existe .env na raiz. Copia env.example para .env e preenche SUPABASE_* (e o resto)."
  echo "      Sem SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY a API pode falhar ao arrancar ou no /health."
fi

echo "== npm ci --omit=dev"
npm ci --omit=dev

echo ""
echo "== Teste rápido (5s) da API em 127.0.0.1:3001"
echo "    Se falhar, vê a mensagem em baixo."

export API_HOST="${API_HOST:-127.0.0.1}"
export API_PORT="${API_PORT:-3001}"

node server/index.mjs &
PID=$!
sleep 2
if curl -sf "http://127.0.0.1:${API_PORT}/api/health" | head -c 200; then
  echo ""
  echo "OK: /api/health respondeu em localhost."
else
  echo ""
  echo "FALHOU: curl http://127.0.0.1:${API_PORT}/api/health"
fi
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true

echo ""
echo "== Próximos passos (manual)"
echo "    1) PM2:  pm2 start deploy/hostinger-vps/ecosystem.config.cjs"
echo "             (edita ecosystem.config.cjs → cwd: $ROOT)"
echo "    2) Nginx: copia deploy/hostinger-vps/nginx-api-severino.conf e certbot SSL"
echo "    3) Público: curl -sS https://api.severino.mestredamente.com/api/health"

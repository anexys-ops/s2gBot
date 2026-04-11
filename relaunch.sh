#!/usr/bin/env bash
# Relance la plateforme unifiée (Laravel BTP + react-frontend) en arrière-plan.
# Logs : .run/*.log — arrêt : ./stop.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
RUN_DIR="$ROOT/.run"
mkdir -p "$RUN_DIR"

if ! command -v npm >/dev/null 2>&1; then
  if [ -f "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
  elif command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
  elif [ -x /opt/homebrew/bin/node ]; then
    export PATH="/opt/homebrew/bin:$PATH"
  elif [ -x /usr/local/bin/node ]; then
    export PATH="/usr/local/bin:$PATH"
  fi
fi

free_port() {
  for port in "$@"; do
    pid=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      echo "Arrêt du processus sur le port $port (PID $pid)..."
      kill -9 $pid 2>/dev/null || true
      sleep 1
    fi
  done
}

echo "Libération des ports 5173, 5174, 8000..."
free_port 5173 5174 8000
sleep 1

: > "$RUN_DIR/pids"

# --- Laravel BTP
PHP_BIN=""
command -v php >/dev/null 2>&1 && PHP_BIN="php"
[ -z "$PHP_BIN" ] && [ -x /opt/homebrew/bin/php ] && PHP_BIN="/opt/homebrew/bin/php"
[ -z "$PHP_BIN" ] && [ -x /usr/local/bin/php ] && PHP_BIN="/usr/local/bin/php"

if [ -n "$PHP_BIN" ] && [ -d "laravel-api/vendor" ]; then
  mkdir -p laravel-api/bootstrap/cache \
    laravel-api/storage/framework/cache/data \
    laravel-api/storage/framework/sessions \
    laravel-api/storage/framework/views \
    laravel-api/storage/logs \
    laravel-api/storage/app/public
  echo "Migrations + seed Laravel..."
  (cd laravel-api && $PHP_BIN artisan migrate --force 2>/dev/null) || true
  (cd laravel-api && $PHP_BIN artisan db:seed --force 2>/dev/null) || true
  echo "Démarrage API Laravel (8000)..."
  (cd laravel-api && nohup $PHP_BIN artisan serve --port=8000 >> "$RUN_DIR/laravel.log" 2>&1 & echo $! >> "$RUN_DIR/pids")
fi

# --- Front unique (react-frontend)
BTP_PORT=5173
FRONT_STARTED=0
if [ -d "react-frontend" ] && command -v npm >/dev/null 2>&1; then
  (cd react-frontend && npm install --silent 2>/dev/null) || true
  echo "Démarrage front plateforme ($BTP_PORT)..."
  (cd react-frontend && nohup npm run dev -- --port "$BTP_PORT" >> "$RUN_DIR/react.log" 2>&1 & echo $! >> "$RUN_DIR/pids")
  FRONT_STARTED=1
elif [ -d "react-frontend" ]; then
  echo "ATTENTION : npm / Node.js introuvable — le front Vite (port $BTP_PORT) n'est pas démarré."
  echo "  Installez Node.js 18+ (paquet officiel ou NodeSource), ou servez react-frontend/dist via Nginx / Docker (voir README.md, docker/README.md)."
fi

echo ""
echo "=============================================="
echo "  Plateforme unifiée — services en arrière-plan"
echo "=============================================="
if [ "$FRONT_STARTED" = 1 ]; then
  echo "  → Application (CRM + Terrain & labo) : http://localhost:$BTP_PORT"
  IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
  [ -n "$IP" ] && echo "                                       http://$IP:$BTP_PORT"
else
  echo "  → Application (Vite) : non démarrée — installez Node.js ou utilisez le build de prod (Docker / Nginx)."
fi
[ -n "$PHP_BIN" ] && echo "  → API Laravel                        : http://localhost:8000"
echo ""
echo "  Après connexion : accueil, ou directement /crm et /terrain (deux onglets possibles)."
echo "  Logs : $RUN_DIR/*.log"
echo "  Arrêt : ./stop.sh"
echo ""

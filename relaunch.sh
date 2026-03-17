#!/usr/bin/env bash
# Relance toute la plateforme en arrière-plan (non bloquant).
# Les services tournent en autonomie ; les logs sont dans .run/*.log

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
RUN_DIR="$ROOT/.run"
mkdir -p "$RUN_DIR"

# Charger Node (nvm, fnm, homebrew)
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

# Libérer les ports utilisés (éviter "address already in use")
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

echo "Libération des ports 3000, 3001, 3002, 3003, 5173, 8000..."
free_port 3000 3001 3002 3003 5173 8000
sleep 1

PIDS=()

# --- Microservices Node (api, back, calcul, auth) + front apps/front
if [ -d "services/api" ] && command -v npm >/dev/null 2>&1; then
  echo "Installation des deps (services Node)..."
  (cd services/api    && npm install --silent 2>/dev/null) || true
  (cd services/back   && npm install --silent 2>/dev/null) || true
  (cd services/calcul && npm install --silent 2>/dev/null) || true
  (cd services/auth   && npm install --silent 2>/dev/null) || true
  echo "Démarrage API (3000), Back (3001), Calcul (3002), Auth (3003)..."
  (cd services/api    && nohup npm run dev >> "$RUN_DIR/api.log" 2>&1 & echo $! >> "$RUN_DIR/pids")
  (cd services/back   && nohup npm run dev >> "$RUN_DIR/back.log" 2>&1 & echo $! >> "$RUN_DIR/pids")
  (cd services/calcul && nohup npm run dev >> "$RUN_DIR/calcul.log" 2>&1 & echo $! >> "$RUN_DIR/pids")
  (cd services/auth   && nohup npm run dev >> "$RUN_DIR/auth.log" 2>&1 & echo $! >> "$RUN_DIR/pids")
  sleep 2
fi

# --- Front (apps/front sur 5173 si présent)
if [ -d "apps/front" ] && command -v npm >/dev/null 2>&1; then
  (cd apps/front && npm install --silent 2>/dev/null) || true
  echo "Démarrage front apps/front (5173)..."
  (cd apps/front && nohup npm run dev >> "$RUN_DIR/front.log" 2>&1 & echo $! >> "$RUN_DIR/pids")
fi

# --- Front BTP (react-frontend sur 5173 si pas de apps/front, ou on utilise 5174 pour éviter conflit)
if [ -d "react-frontend" ] && command -v npm >/dev/null 2>&1; then
  (cd react-frontend && npm install --silent 2>/dev/null) || true
  # Si 5173 déjà pris par apps/front, on lance le BTP sur 5174
  if lsof -ti :5173 >/dev/null 2>&1; then
    echo "Port 5173 occupé. Démarrage front BTP sur 5174..."
    (cd react-frontend && nohup npm run dev -- --port 5174 >> "$RUN_DIR/react-btp.log" 2>&1 & echo $! >> "$RUN_DIR/pids")
    BTP_PORT=5174
  else
    echo "Démarrage front BTP (5173)..."
    (cd react-frontend && nohup npm run dev >> "$RUN_DIR/react-btp.log" 2>&1 & echo $! >> "$RUN_DIR/pids")
    BTP_PORT=5173
  fi
fi

# --- Laravel BTP (si PHP dispo)
PHP_BIN=""
command -v php >/dev/null 2>&1 && PHP_BIN="php"
[ -z "$PHP_BIN" ] && [ -x /opt/homebrew/bin/php ] && PHP_BIN="/opt/homebrew/bin/php"
[ -z "$PHP_BIN" ] && [ -x /usr/local/bin/php ] && PHP_BIN="/usr/local/bin/php"

if [ -n "$PHP_BIN" ] && [ -d "laravel-api/vendor" ]; then
  echo "Migrations + seed Laravel (rapide)..."
  (cd laravel-api && $PHP_BIN artisan migrate --force 2>/dev/null) || true
  (cd laravel-api && $PHP_BIN artisan db:seed --force 2>/dev/null) || true
  echo "Démarrage API Laravel BTP (8000)..."
  (cd laravel-api && nohup $PHP_BIN artisan serve --port=8000 >> "$RUN_DIR/laravel.log" 2>&1 & echo $! >> "$RUN_DIR/pids")
fi

echo ""
echo "=============================================="
echo "  Relance terminée — services en arrière-plan"
echo "=============================================="
echo "  → API Gateway    : http://localhost:3000"
echo "  → Front (apps)   : http://localhost:5173"
[ -n "$BTP_PORT" ] && echo "  → Front BTP       : http://localhost:$BTP_PORT"
[ -n "$PHP_BIN" ] && echo "  → API Laravel BTP : http://localhost:8000"
echo ""
echo "  Logs : $RUN_DIR/*.log"
echo "  Arrêter tout    : ./stop.sh"
echo ""

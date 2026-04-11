#!/usr/bin/env bash
# Lance la plateforme BTP (Laravel API + React) et injecte le seed si besoin

set -e
cd "$(dirname "$0")"

# Charger Node si besoin (nvm, fnm, homebrew)
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

# Dossiers Laravel requis (sinon erreur 500 « valid cache path »)
if [ -d "laravel-api" ]; then
  mkdir -p laravel-api/bootstrap/cache \
    laravel-api/storage/framework/cache/data \
    laravel-api/storage/framework/sessions \
    laravel-api/storage/framework/views \
    laravel-api/storage/logs \
    laravel-api/storage/app/public
  chmod -R ug+rwx laravel-api/bootstrap/cache laravel-api/storage 2>/dev/null || true
fi

# Migrations + seed Laravel si PHP dispo
if command -v php >/dev/null 2>&1 && [ -d "laravel-api/vendor" ]; then
  echo "Migrations + seed Laravel BTP..."
  (cd laravel-api && php artisan migrate --force 2>/dev/null || true)
  (cd laravel-api && php artisan db:seed --force 2>/dev/null || true)
  echo ""
fi

# Démarrer Laravel en arrière-plan si PHP dispo
if command -v php >/dev/null 2>&1 && [ -d "laravel-api/vendor" ]; then
  echo "Démarrage API Laravel (port 8000)..."
  (cd laravel-api && php artisan serve --port=8000) &
  LARAVEL_PID=$!
  sleep 2
fi

# Démarrer le front React BTP
if command -v npm >/dev/null 2>&1 && [ -d "react-frontend/node_modules" ]; then
  echo "Démarrage front React BTP (port 5173)..."
  (cd react-frontend && npm run dev) &
  FRONT_PID=$!
elif command -v npm >/dev/null 2>&1; then
  echo "Installation des dépendances React..."
  (cd react-frontend && npm install --silent && npm run dev) &
  FRONT_PID=$!
else
  echo "npm non trouvé. Installez Node.js pour lancer le front BTP."
fi

echo ""
echo "  → Application (CRM + Terrain & labo) : http://localhost:5173"
echo "     · CRM : http://localhost:5173/crm"
echo "     · Terrain & labo : http://localhost:5173/terrain"
echo "  → API Laravel : http://localhost:8000"
echo ""
echo "Pour injecter uniquement le seed plus tard : ./scripts/seed-btp.sh"
echo "Ctrl+C pour arrêter."
echo ""

wait 2>/dev/null || true

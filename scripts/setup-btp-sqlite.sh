#!/usr/bin/env bash
# Configure Laravel BTP avec SQLite (aucun MySQL à installer).
# À lancer APRÈS install-php-mac.sh, dans le même terminal :
#   ./scripts/setup-btp-sqlite.sh

set -e
cd "$(dirname "$0")/.."

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -f /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
elif [ -f /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null || true
fi

if ! command -v php >/dev/null 2>&1; then
  echo "PHP n'est pas installé. Lance d'abord : ./scripts/install-php-mac.sh"
  exit 1
fi

LARAVEL="laravel-api"
echo "Configuration de $LARAVEL avec SQLite..."
echo ""

mkdir -p "$LARAVEL/bootstrap/cache" \
  "$LARAVEL/storage/framework/cache/data" \
  "$LARAVEL/storage/framework/sessions" \
  "$LARAVEL/storage/framework/views" \
  "$LARAVEL/storage/logs" \
  "$LARAVEL/storage/app/public"
chmod -R ug+rwx "$LARAVEL/bootstrap/cache" "$LARAVEL/storage" 2>/dev/null || true
[ -f "$LARAVEL/.env" ] || cp "$LARAVEL/.env.example" "$LARAVEL/.env"

# Forcer SQLite (compatible macOS et Linux)
if sed --version 2>/dev/null | grep -q GNU; then
  sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/' "$LARAVEL/.env"
  sed -i 's/^DB_DATABASE=.*/DB_DATABASE=database\/database.sqlite/' "$LARAVEL/.env"
else
  sed -i '' 's/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/' "$LARAVEL/.env"
  sed -i '' 's/^DB_DATABASE=.*/DB_DATABASE=database\/database.sqlite/' "$LARAVEL/.env"
fi

touch "$LARAVEL/database/database.sqlite"
echo "Fichier base SQLite créé."

cd "$LARAVEL"
[ -d vendor ] || composer install --no-interaction
php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --force
cd ..

echo ""
echo "=========================================="
echo "  C'est prêt"
echo "=========================================="
echo ""
echo "Démarre l'API et le front avec :"
echo "  ./start-btp.sh"
echo ""
echo "Puis ouvre : http://localhost:5173"
echo "Connexion démo : admin@lab.local / password"
echo ""

#!/usr/bin/env bash
# Migre et injecte le seed pour la plateforme BTP (laravel-api)

set -e
cd "$(dirname "$0")/.."

# Ajouter chemins courants (Homebrew, Docker Desktop sur Mac)
export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"

# Trouver php (PATH ou Homebrew)
PHP_BIN=""
if command -v php >/dev/null 2>&1; then
  PHP_BIN="php"
elif [ -x /opt/homebrew/bin/php ]; then
  PHP_BIN="/opt/homebrew/bin/php"
elif [ -x /usr/local/bin/php ]; then
  PHP_BIN="/usr/local/bin/php"
fi

if [ -z "$PHP_BIN" ]; then
  echo "PHP non trouvé. Installez PHP (brew install php) ou exécutez dans un conteneur Docker."
  echo "Puis : cd laravel-api && php artisan migrate --force && php artisan db:seed --force"
  exit 1
fi

if [ ! -d "laravel-api/vendor" ]; then
  echo "Dépendances Laravel absentes. Exécutez : cd laravel-api && composer install"
  exit 1
fi

echo "Migrations Laravel BTP..."
(cd laravel-api && $PHP_BIN artisan migrate --force)

echo "Injection du seed (utilisateurs, types d'essais, etc.)..."
(cd laravel-api && $PHP_BIN artisan db:seed --force)

echo "Seed BTP terminé."

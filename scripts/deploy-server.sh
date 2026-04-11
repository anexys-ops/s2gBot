#!/usr/bin/env bash
# À exécuter sur le serveur, à la racine du dépôt (après git pull).
# Prérequis : PHP 8.2+, Composer, Node.js 18+, npm.
# Variables optionnelles :
#   DEPLOY_PUBLIC_HTML — si défini, rsync de react-frontend/dist/ vers ce dossier (ex. /var/www/lab/html)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Deploy s2gBot depuis $ROOT ==="

if [ -d laravel-api ]; then
  mkdir -p laravel-api/bootstrap/cache \
    laravel-api/storage/framework/cache/data \
    laravel-api/storage/framework/sessions \
    laravel-api/storage/framework/views \
    laravel-api/storage/logs \
    laravel-api/storage/app/public
  chmod -R ug+rwx laravel-api/bootstrap/cache laravel-api/storage 2>/dev/null || true
fi

if [ -f laravel-api/artisan ]; then
  if [ ! -f laravel-api/.env ] && [ -f laravel-api/.env.example ]; then
    echo "→ Création laravel-api/.env depuis .env.example + APP_KEY"
    cp laravel-api/.env.example laravel-api/.env
    (cd laravel-api && php artisan key:generate --force)
    echo "  Éditez laravel-api/.env (APP_URL, FRONTEND_URL, DB_*, SANCTUM_STATEFUL_DOMAINS, APP_DEBUG=false)."
  fi
  echo "→ Composer (Laravel)"
  (cd laravel-api && composer install --no-dev --no-interaction --optimize-autoloader)
  echo "→ Migrations"
  (cd laravel-api && php artisan migrate --force)
  echo "→ Optimisation Laravel (route:clear évite un cache de routes obsolète si api.php a changé)"
  (cd laravel-api && php artisan route:clear && php artisan optimize)
fi

if [ -f react-frontend/package.json ]; then
  echo "→ Build React (Vite)"
  (cd react-frontend && npm ci && npm run build)
fi

if [ -n "${DEPLOY_PUBLIC_HTML:-}" ]; then
  echo "→ Publication front : $DEPLOY_PUBLIC_HTML"
  mkdir -p "$DEPLOY_PUBLIC_HTML"
  rsync -a --delete "${ROOT}/react-frontend/dist/" "${DEPLOY_PUBLIC_HTML}/"
fi

echo "=== Terminé ==="

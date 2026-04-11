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

  # Aligner APP_VERSION sur react-frontend/package.json (footer API = même numéro que le front buildé)
  if [ -f laravel-api/.env ] && [ -f react-frontend/package.json ]; then
    PKG_VER=""
    if command -v node >/dev/null 2>&1; then
      PKG_VER="$(cd "$ROOT/react-frontend" && node -p "require('./package.json').version" 2>/dev/null || true)"
    fi
    if [ -z "$PKG_VER" ] && command -v jq >/dev/null 2>&1; then
      PKG_VER="$(jq -r '.version // empty' "$ROOT/react-frontend/package.json" 2>/dev/null || true)"
    fi
    if [ -n "$PKG_VER" ] && [ "$PKG_VER" != "null" ]; then
      if grep -q '^APP_VERSION=' laravel-api/.env 2>/dev/null; then
        sed -i.bak "s/^APP_VERSION=.*/APP_VERSION=$PKG_VER/" laravel-api/.env && rm -f laravel-api/.env.bak
      else
        printf '\nAPP_VERSION=%s\n' "$PKG_VER" >> laravel-api/.env
      fi
      echo "→ APP_VERSION=$PKG_VER (auto, package.json)"
    fi
  fi

  echo "→ Composer (Laravel)"
  (cd laravel-api && composer install --no-dev --no-interaction --optimize-autoloader)
  echo "→ Migrations"
  (cd laravel-api && php artisan migrate --force)
  echo "→ Optimisation Laravel (route:clear + config:clear pour version / routes à jour)"
  (cd laravel-api && php artisan route:clear && php artisan config:clear && php artisan optimize)
fi

if [ -f react-frontend/package.json ]; then
  echo "→ Build React (Vite)"
  GIT_COMMIT_SHORT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || true)"
  if [ -n "${GIT_COMMIT_SHORT}" ]; then
    export GIT_COMMIT_SHORT
    echo "  (footer : commit ${GIT_COMMIT_SHORT})"
  fi
  (cd react-frontend && npm ci && npm run build)
fi

if [ -n "${DEPLOY_PUBLIC_HTML:-}" ]; then
  echo "→ Publication front : $DEPLOY_PUBLIC_HTML"
  mkdir -p "$DEPLOY_PUBLIC_HTML"
  rsync -a --delete "${ROOT}/react-frontend/dist/" "${DEPLOY_PUBLIC_HTML}/"
fi

echo "=== Terminé ==="

#!/usr/bin/env bash
# Après modification de .env.docker : recréer « app » pour recharger les variables d’environnement,
# puis régénérer les caches Laravel dans le conteneur.
#
# Usage : ./scripts/docker-env-apply.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_DOCKER_FILE:-.env.docker}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier introuvable : $ENV_FILE"
  exit 1
fi
DC=(docker compose --env-file "$ENV_FILE")

echo "=== Recréation du conteneur app (recharge .env.docker) ==="
"${DC[@]}" up -d --force-recreate app

echo "=== Caches Laravel dans app ==="
"${DC[@]}" exec -T app php artisan config:cache
"${DC[@]}" exec -T app php artisan route:cache
"${DC[@]}" exec -T app php artisan view:cache

echo "=== OK — vérifier : curl -sS http://127.0.0.1:\${HTTP_PORT}/api/version (HTTP_PORT dans .env.docker) ==="

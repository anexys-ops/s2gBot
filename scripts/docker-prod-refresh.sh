#!/usr/bin/env bash
# Prod Docker : vide les caches Laravel (volume bootstrap/cache + storage),
# reconstruit les images (API + front dans Nginx) et recrée app + web.
# Ne recrée pas « db » (données MySQL inchangées).
#
# Sur le serveur, depuis la racine du dépôt (docker-compose.yml + .env.docker) :
#   chmod +x scripts/docker-prod-refresh.sh
#   ./scripts/docker-prod-refresh.sh
#
# Autre fichier d'environnement :
#   ENV_DOCKER_FILE=/chemin/.env.docker ./scripts/docker-prod-refresh.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# SHA court pour le build du front (docker/nginx/Dockerfile → Vite). Priorité : env déjà défini, puis dépôt git local.
if [ -z "${GIT_COMMIT_SHORT:-}" ] && [ -d "$ROOT/.git" ]; then
  GIT_COMMIT_SHORT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || true)"
  export GIT_COMMIT_SHORT
fi
ENV_FILE="${ENV_DOCKER_FILE:-.env.docker}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier introuvable : $ENV_FILE (ex. cp docker/env.docker.example .env.docker)"
  exit 1
fi

DC=(docker compose --env-file "$ENV_FILE")

echo "=== 1/2 Caches Laravel dans le conteneur app (optimize:clear) ==="
if ! "${DC[@]}" exec -T app php artisan optimize:clear; then
  echo "Échec : le service « app » doit tourner. Essayez : ${DC[*]} up -d"
  exit 1
fi

echo "=== 2/2 Build + recréation des conteneurs app et web ==="
"${DC[@]}" up -d --build --force-recreate app web

echo "=== Terminé. Le conteneur app relance migrate + caches (docker-entrypoint) si RUN_OPTIMIZE=1 ==="

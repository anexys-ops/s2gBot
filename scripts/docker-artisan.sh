#!/usr/bin/env bash
# Exécute php artisan dans le conteneur « app » (stack Docker /opt/s2gBot).
# Ne pas utiliser : php artisan sur l’hôte dans /var/www/… — ce n’est pas la même instance Laravel.
#
# Usage (sur le serveur, racine du dépôt avec .env.docker) :
#   ./scripts/docker-artisan.sh migrate --force
#   ./scripts/docker-artisan.sh config:clear
#   ./scripts/docker-artisan.sh config:cache

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_DOCKER_FILE:-.env.docker}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier introuvable : $ENV_FILE"
  exit 1
fi
exec docker compose --env-file "$ENV_FILE" exec app php artisan "$@"

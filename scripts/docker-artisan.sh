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

# Source de variables pour `docker compose` (identique à docker-prod-refresh.sh).
# Sur la prod, `.env.docker` n’est pas versionné et est exclu du rsync GitHub Actions.
resolve_env_file() {
  if [[ -n "${ENV_DOCKER_FILE:-}" ]]; then
    if [[ -f "$ENV_DOCKER_FILE" ]]; then
      echo "$ENV_DOCKER_FILE"
      return 0
    fi
    echo "Fichier introuvable : ENV_DOCKER_FILE=$ENV_DOCKER_FILE" >&2
    return 1
  fi
  for candidate in .env.docker docker/.env.docker; do
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if ! ENV_FILE="$(resolve_env_file)"; then
  echo "Fichier d’environnement Docker introuvable (attendu : .env.docker à la racine du dépôt)."
  echo "Le déploiement rsync n’envoie pas ce fichier (secrets locaux). Création une fois sur le serveur :"
  echo "  cp docker/env.docker.example .env.docker"
  echo "Puis éditer .env.docker (APP_KEY, DB_*, APP_URL, HTTP_PORT, etc.) et :"
  echo "  docker compose --env-file .env.docker up -d"
  echo "Ou forcer le chemin : ENV_DOCKER_FILE=/chemin/.env.docker ./scripts/docker-artisan.sh …"
  exit 1
fi

exec docker compose --env-file "$ENV_FILE" exec app php artisan "$@"

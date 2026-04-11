#!/usr/bin/env bash
# Démarre la stack Docker (racine du dépôt).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env.docker ]]; then
  echo "Création de .env.docker à partir de docker/env.docker.example"
  cp docker/env.docker.example .env.docker
  echo "Éditez .env.docker (APP_URL, APP_KEY, mots de passe) puis relancez ce script."
  exit 1
fi
exec docker compose --env-file .env.docker up -d --build "$@"

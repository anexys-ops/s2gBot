#!/usr/bin/env bash
# Prod Docker : arrêt ciblé app + web, rebuild images (--no-cache --pull par défaut),
# redémarrage, puis caches Laravel (clear avant si l’ancien app tournait, cache après boot).
# Ne touche pas au service « db » (données MySQL inchangées).
#
# Depuis la racine du dépôt :
#   chmod +x scripts/docker-prod-refresh.sh
#   ./scripts/docker-prod-refresh.sh
#
# Build plus rapide (réutilise le cache Docker ; à éviter si seul le code a changé) :
#   NO_CACHE=0 ./scripts/docker-prod-refresh.sh
#
# Autre fichier d'environnement :
#   ENV_DOCKER_FILE=/chemin/.env.docker ./scripts/docker-prod-refresh.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# SHA court pour le build du front (docker/nginx/Dockerfile → Vite).
if [ -z "${GIT_COMMIT_SHORT:-}" ] && [ -d "$ROOT/.git" ]; then
  GIT_COMMIT_SHORT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
  export GIT_COMMIT_SHORT
fi

ENV_FILE="${ENV_DOCKER_FILE:-.env.docker}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier introuvable : $ENV_FILE (ex. cp docker/env.docker.example .env.docker)"
  exit 1
fi

NO_CACHE="${NO_CACHE:-1}"
DC=(docker compose --env-file "$ENV_FILE")

echo "=== 0/6 Contexte déploiement ==="
echo "ENV_FILE=$ENV_FILE"
echo "GIT_COMMIT_SHORT=${GIT_COMMIT_SHORT:-}"
echo "NO_CACHE=$NO_CACHE (NO_CACHE=0 pour un build avec cache Docker)"
if [[ -f "$ENV_FILE" ]] && grep -q '^APP_VERSION=' "$ENV_FILE" 2>/dev/null; then
  grep '^APP_VERSION=' "$ENV_FILE" | head -1
else
  echo "APP_VERSION : non défini dans $ENV_FILE (recommandé pour /api/version)"
fi

echo "=== 1/6 Caches Laravel (optimize:clear) si l’ancien conteneur app répond ==="
if "${DC[@]}" exec -T app true 2>/dev/null; then
  "${DC[@]}" exec -T app php artisan optimize:clear || true
else
  echo "app absent ou non joignable — étape ignorée."
fi

echo "=== 2/6 Arrêt et suppression des conteneurs app et web uniquement (db intact) ==="
"${DC[@]}" stop app web 2>/dev/null || true
"${DC[@]}" rm -f app web 2>/dev/null || true

echo "=== 3/6 Build images app + web (--pull ; --no-cache si NO_CACHE=1) ==="
BUILD_OPTS=(--pull)
if [[ "$NO_CACHE" == "1" ]]; then
  BUILD_OPTS+=(--no-cache)
fi
"${DC[@]}" build "${BUILD_OPTS[@]}" app web

echo "=== 4/6 Démarrage app + web ==="
"${DC[@]}" up -d app web

echo "=== 5/6 Attente du conteneur app puis config Laravel ==="
for _ in $(seq 1 30); do
  if "${DC[@]}" exec -T app php artisan --version >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
"${DC[@]}" exec -T app php artisan config:clear
"${DC[@]}" exec -T app php artisan config:cache

echo "=== 6/6 État compose + version effective dans le conteneur app ==="
"${DC[@]}" ps
echo "--- printenv (app) ---"
"${DC[@]}" exec -T app sh -c 'printf "APP_VERSION=%s\nGIT_COMMIT_SHORT=%s\n" "${APP_VERSION:-}" "${GIT_COMMIT_SHORT:-}"'
echo "=== Terminé. Vérifier : curl -s \"\$APP_URL/api/version\" (attendu : api alignée sur APP_VERSION du .env) ==="

#!/usr/bin/env bash
# Déploie Laravel + build Vite (SPA) sur le serveur distant.
#
# Prérequis local : Node, npm, rsync, ssh.
# Prérequis distant : PHP 8.2+ + extensions Laravel, Composer, php-fpm, nginx.
#
# 1) cp scripts/deploy-apps-dev.example.env deploy.env
# 2) Éditer deploy.env
# 3) Depuis la racine du dépôt :
#    set -a && source deploy.env && set +a && ./scripts/deploy-apps-dev.sh
#
# Le front compilé est copié dans laravel-api/public/ (à côté de index.php).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEPLOY_HOST="${DEPLOY_HOST:?Définir DEPLOY_HOST (voir scripts/deploy-apps-dev.example.env)}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_USER="${DEPLOY_USER:-root}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/s2gBot}"

# Placeholders — évite rsync/ssh vers un hôte fictif.
if [[ "$DEPLOY_HOST" == *'.example.com' ]] || [[ "$DEPLOY_HOST" == 'CHANGEME' ]] || [[ "$DEPLOY_HOST" == 'REMPLACER_PAR_IP_OU_HOSTNAME' ]]; then
  echo "ERREUR: DEPLOY_HOST=$DEPLOY_HOST est encore un placeholder." >&2
  echo "Éditez deploy.env : mettez l’IP ou le vrai nom DNS du serveur (ex. 203.0.113.10 ou app.mondomaine.fr)." >&2
  echo "Astuce : ne collez pas les lignes de commentaire « # … » dans le terminal comme des commandes." >&2
  exit 1
fi

remote_ssh() {
  if [ -n "${SSH_IDENTITY_FILE:-}" ]; then
    ssh -i "$SSH_IDENTITY_FILE" -p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$DEPLOY_HOST" "$@"
  else
    ssh -p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$DEPLOY_HOST" "$@"
  fi
}

if [ -n "${SSH_IDENTITY_FILE:-}" ]; then
  RSYNC_E="ssh -i ${SSH_IDENTITY_FILE} -p ${DEPLOY_PORT} -o StrictHostKeyChecking=accept-new"
else
  RSYNC_E="ssh -p ${DEPLOY_PORT} -o StrictHostKeyChecking=accept-new"
fi

RSYNC_CODE=(rsync -az --delete -e "$RSYNC_E" --exclude .git --exclude node_modules --exclude .env)
echo "==> Build react-frontend (production)"
(cd react-frontend && npm ci && npm run build)

echo "==> Sync Laravel (sans vendor) — public/ côté serveur aligné sur le dépôt (souvent index.php seul)"
"${RSYNC_CODE[@]}" "$ROOT/laravel-api/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_PATH/laravel-api/"
echo "==> Copie du build Vite dans public/ (protect index.php Laravel, --delete pour anciens assets)"
rsync -az --delete -e "$RSYNC_E" \
  --filter 'protect index.php' \
  "$ROOT/react-frontend/dist/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_PATH/laravel-api/public/"

echo "==> Composer, migrations, caches (distant)"
remote_ssh REMOTE_PATH="$REMOTE_PATH" bash -s <<'REMOTE'
set -euo pipefail
cd "$REMOTE_PATH/laravel-api"
if [ ! -f .env ]; then
  echo "ERREUR: créer $REMOTE_PATH/laravel-api/.env (APP_KEY, APP_URL, DB_*, FRONTEND_URL)" >&2
  exit 1
fi
composer install --no-dev --optimize-autoloader --no-interaction --ignore-platform-reqs
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
chmod -R ug+rw storage bootstrap/cache 2>/dev/null || true
echo "Déploiement distant OK."
REMOTE

echo ""
echo "Terminé. Nginx : voir scripts/nginx-s2g.apps-dev.fr.example.conf"
echo "Sur le serveur : APP_URL et FRONTEND_URL dans laravel-api/.env = votre URL publique HTTPS."

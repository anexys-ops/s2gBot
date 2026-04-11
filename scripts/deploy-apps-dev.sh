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
#
# Répertoire sur le serveur : REMOTE_PATH (ex. /var/www/s2gBot ou /var/www/s2gBot-test).
# Tout le dépôt est synchronisé sauf node_modules, vendor, deploy.env (et .git sauf DEPLOY_SYNC_GIT=1).

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

DEPLOY_PUBLIC_DOMAIN="${DEPLOY_PUBLIC_DOMAIN:-s2g.apps-dev.fr}"
DEPLOY_DB_ENGINE="${DEPLOY_DB_ENGINE:-mariadb}"
DEPLOY_FOR_TESTS="${DEPLOY_FOR_TESTS:-0}"
DEPLOY_SYNC_GIT="${DEPLOY_SYNC_GIT:-0}"

# Sync : tout le monorepo sauf dépendances lourdes (node_modules, vendor) et secrets locaux.
# DEPLOY_SYNC_GIT=1 inclut .git/ (copie intégrale pour archives ou git sur le serveur).
RSYNC_EXCLUDES=(
  --exclude 'node_modules/'
  --exclude 'laravel-api/vendor/'
  --exclude 'deploy.env'
  --exclude '.cursor/'
  --exclude 'laravel-api/.env'
)
if [ "$DEPLOY_SYNC_GIT" != "1" ]; then
  RSYNC_EXCLUDES+=(--exclude '.git/')
fi

RSYNC_APP=(
  rsync -az --delete
  -e "$RSYNC_E"
  "${RSYNC_EXCLUDES[@]}"
  --filter 'protect laravel-api/.env'
  --filter 'protect laravel-api/storage/'
  --filter 'protect laravel-api/bootstrap/cache/'
)

echo "==> Build react-frontend (production)"
(cd react-frontend && npm ci && npm run build)

echo "==> Création du répertoire distant $REMOTE_PATH (si besoin)"
remote_ssh "mkdir -p '$REMOTE_PATH'"

if [ "$DEPLOY_SYNC_GIT" = "1" ]; then
  echo "==> Sync dépôt vers $REMOTE_PATH (incl. .git ; exclus : node_modules, vendor, deploy.env)"
else
  echo "==> Sync dépôt vers $REMOTE_PATH (exclus : .git, node_modules, vendor, deploy.env ; .env & storage préservés)"
fi
"${RSYNC_APP[@]}" "$ROOT/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_PATH/"

echo "==> Copie du build Vite dans laravel-api/public/ (protect index.php Laravel, --delete pour anciens assets)"
rsync -az --delete -e "$RSYNC_E" \
  --filter 'protect index.php' \
  "$ROOT/react-frontend/dist/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_PATH/laravel-api/public/"

echo "==> Stack serveur : MariaDB ou PostgreSQL + .env (DEPLOY_DB_ENGINE=$DEPLOY_DB_ENGINE, domaine $DEPLOY_PUBLIC_DOMAIN, DEPLOY_FOR_TESTS=$DEPLOY_FOR_TESTS)"
remote_ssh "DEPLOY_DB_ENGINE='${DEPLOY_DB_ENGINE}' DEPLOY_FOR_TESTS='${DEPLOY_FOR_TESTS}' bash '${REMOTE_PATH}/scripts/server-ensure-stack-debian.sh' '${REMOTE_PATH}' '${DEPLOY_PUBLIC_DOMAIN}'"

echo "==> Composer, migrations, caches (distant)"
remote_ssh DEPLOY_FOR_TESTS="${DEPLOY_FOR_TESTS}" REMOTE_PATH="$REMOTE_PATH" bash -s <<'REMOTE'
set -euo pipefail
export COMPOSER_ALLOW_SUPERUSER=1
cd "$REMOTE_PATH/laravel-api"
# SSH non interactif : PATH souvent minimal — chercher PHP comme relaunch.sh
PHP_BIN=""
command -v php >/dev/null 2>&1 && PHP_BIN=$(command -v php)
[ -z "$PHP_BIN" ] && [ -x /usr/bin/php8.2 ] && PHP_BIN=/usr/bin/php8.2
[ -z "$PHP_BIN" ] && [ -x /usr/bin/php8.3 ] && PHP_BIN=/usr/bin/php8.3
[ -z "$PHP_BIN" ] && [ -x /usr/bin/php8.4 ] && PHP_BIN=/usr/bin/php8.4
[ -z "$PHP_BIN" ] && [ -x /usr/bin/php ] && PHP_BIN=/usr/bin/php
if [ -z "$PHP_BIN" ]; then
  echo "ERREUR: PHP introuvable sur le serveur (essayez apt install php8.2-cli)." >&2
  exit 1
fi
COMPOSER_BIN=""
command -v composer >/dev/null 2>&1 && COMPOSER_BIN=$(command -v composer)
[ -z "$COMPOSER_BIN" ] && [ -x /usr/local/bin/composer ] && COMPOSER_BIN=/usr/local/bin/composer
if [ -z "$COMPOSER_BIN" ]; then
  echo "ERREUR: composer introuvable sur le serveur." >&2
  exit 1
fi
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "→ .env créé depuis .env.example (premier déploiement)."
    echo ""
    echo "IMPORTANT : éditez $REMOTE_PATH/laravel-api/.env sur le serveur :" >&2
    echo "  - APP_URL=https://s2g.apps-dev.fr  (votre domaine HTTPS)" >&2
    echo "  - FRONTEND_URL=https://s2g.apps-dev.fr" >&2
    echo "  - SANCTUM_STATEFUL_DOMAINS=s2g.apps-dev.fr  (sans https://)" >&2
    echo "  - La prochaine étape provisionne MariaDB/PostgreSQL (scripts/server-ensure-stack-debian.sh)." >&2
    echo "  - APP_DEBUG=false en production" >&2
    echo ""
  else
    echo "ERREUR: pas de .env ni .env.example dans laravel-api/" >&2
    exit 1
  fi
fi
echo "→ Composer install (requis avant artisan)…"
if [ "${DEPLOY_FOR_TESTS:-0}" = "1" ]; then
  "$COMPOSER_BIN" install --optimize-autoloader --no-interaction --ignore-platform-reqs
else
  "$COMPOSER_BIN" install --no-dev --optimize-autoloader --no-interaction --ignore-platform-reqs
fi
if ! grep -qE '^APP_KEY=base64:.+' .env 2>/dev/null; then
  echo "→ Génération APP_KEY (manquant ou incomplet)."
  "$PHP_BIN" artisan key:generate --force
fi
# Même logique que deploy-server.sh : footer API = version package.json du front
if [ -f .env ] && [ -f ../react-frontend/package.json ]; then
  PKG_VER=""
  if command -v node >/dev/null 2>&1; then
    PKG_VER="$(cd ../react-frontend && node -p "require('./package.json').version" 2>/dev/null || true)"
  fi
  if [ -z "$PKG_VER" ] && command -v jq >/dev/null 2>&1; then
    PKG_VER="$(jq -r '.version // empty' ../react-frontend/package.json 2>/dev/null || true)"
  fi
  if [ -n "$PKG_VER" ] && [ "$PKG_VER" != "null" ]; then
    if grep -q '^APP_VERSION=' .env 2>/dev/null; then
      sed -i.bak "s/^APP_VERSION=.*/APP_VERSION=$PKG_VER/" .env && rm -f .env.bak
    else
      printf '\nAPP_VERSION=%s\n' "$PKG_VER" >> .env
    fi
    echo "→ APP_VERSION=$PKG_VER (auto, package.json)"
  fi
fi
"$PHP_BIN" artisan config:clear
"$PHP_BIN" artisan migrate --force
"$PHP_BIN" artisan db:seed --force
"$PHP_BIN" artisan storage:link 2>/dev/null || true
if [ "${DEPLOY_FOR_TESTS:-0}" = "1" ]; then
  echo "→ Mode tests : pas de config/route/view cache (modifs .env visibles sans optimize:clear)."
  "$PHP_BIN" artisan route:clear 2>/dev/null || true
  "$PHP_BIN" artisan view:clear 2>/dev/null || true
else
  "$PHP_BIN" artisan config:cache
  "$PHP_BIN" artisan route:clear
  "$PHP_BIN" artisan route:cache
  "$PHP_BIN" artisan view:cache
fi
chmod -R ug+rw storage bootstrap/cache 2>/dev/null || true
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
echo "Déploiement distant OK."
REMOTE

# Corrige souvent HTTPS bloqué après TLS (ex. ssl_stapling / vhost incomplet).
DEPLOY_NGINX_ENSURE="${DEPLOY_NGINX_ENSURE:-1}"
if [ "$DEPLOY_NGINX_ENSURE" = "1" ]; then
  echo "==> Nginx : vhost SPA + API (server-ensure-nginx-debian.sh, DEPLOY_NGINX_ENSURE=1)"
  remote_ssh "bash '${REMOTE_PATH}/scripts/server-ensure-nginx-debian.sh' '${REMOTE_PATH}' '${DEPLOY_PUBLIC_DOMAIN}'" \
    || echo "AVERTISSEMENT : étape Nginx échouée — corrigez les chemins TLS ou lancez le script à la main sur le serveur." >&2
fi

echo ""
echo "Terminé. Répertoire distant : $REMOTE_PATH"
echo "Nginx : scripts/server-ensure-nginx-debian.sh (auto si DEPLOY_NGINX_ENSURE=1) ; exemple : scripts/nginx-s2g.apps-dev.fr.example.conf"
echo "Mot de passe BDD applicatif : /root/.s2gBot_db_password sur le serveur (utilisateur lab_btp / base lab_btp)."
echo "PostgreSQL : DEPLOY_DB_ENGINE=pgsql dans deploy.env."
echo "Copie + .git : DEPLOY_SYNC_GIT=1. Serveur de tests : DEPLOY_FOR_TESTS=1 (staging, debug, composer avec dev)."

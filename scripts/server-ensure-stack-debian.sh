#!/usr/bin/env bash
# Provisionnement idempotent sur Debian 12+ : MariaDB ou PostgreSQL + extensions PHP,
# base lab_btp + utilisateur lab_btp, mise à jour laravel-api/.env.
#
# Usage :
#   bash scripts/server-ensure-stack-debian.sh /var/www/s2gBot s2g.apps-dev.fr
# Variables :
#   DEPLOY_DB_ENGINE=mariadb | pgsql   (défaut mariadb)
#   DEPLOY_FOR_TESTS=1                 (APP_ENV=staging, APP_DEBUG=true — serveur de tests)

set -euo pipefail

REMOTE_PATH="${1:?Usage: $0 /var/www/s2gBot [domaine_public]}"
PUBLIC_DOMAIN="${2:-s2g.apps-dev.fr}"
DEPLOY_DB_ENGINE="${DEPLOY_DB_ENGINE:-mariadb}"
DEPLOY_FOR_TESTS="${DEPLOY_FOR_TESTS:-0}"

LARAVEL="$REMOTE_PATH/laravel-api"
ENV_FILE="$LARAVEL/.env"
SECRETS_FILE="/root/.s2gBot_db_password"
DB_NAME="lab_btp"
DB_USER="lab_btp"

export DEBIAN_FRONTEND=noninteractive

if [ ! -d "$LARAVEL" ]; then
  echo "ERREUR: $LARAVEL introuvable." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ] && [ -f "$LARAVEL/.env.example" ]; then
  cp "$LARAVEL/.env.example" "$ENV_FILE"
  echo "→ .env créé depuis .env.example"
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "ERREUR: pas de .env dans $LARAVEL" >&2
  exit 1
fi

echo "==> Paquets : PHP 8.2, MariaDB, PostgreSQL (moteur choisi : $DEPLOY_DB_ENGINE)"
apt-get update -qq
apt-get install -y -qq \
  php8.2-cli php8.2-fpm php8.2-mysql php8.2-pgsql php8.2-xml php8.2-mbstring \
  php8.2-curl php8.2-zip php8.2-bcmath \
  mariadb-server postgresql postgresql-contrib \
  >/dev/null

systemctl enable --now mariadb 2>/dev/null || true
systemctl enable --now postgresql 2>/dev/null || true
systemctl reload php8.2-fpm 2>/dev/null || true

if [ -f "$SECRETS_FILE" ]; then
  DBPASS=$(tr -d '\n\r' <"$SECRETS_FILE")
else
  DBPASS=$(openssl rand -hex 20)
  printf '%s' "$DBPASS" >"$SECRETS_FILE"
  chmod 600 "$SECRETS_FILE"
  echo "→ Mot de passe BDD : fichier $SECRETS_FILE (sauvegardez-le)."
fi

# Retire les anciennes lignes DB_* et DB_CONNECTION=sqlite pour réécrire proprement
for k in DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD; do
  if [ -f "$ENV_FILE" ]; then
    grep -v "^${k}=" "$ENV_FILE" >"${ENV_FILE}.new" && mv "${ENV_FILE}.new" "$ENV_FILE"
  fi
done
grep -v '^DB_CONNECTION=sqlite' "$ENV_FILE" >"${ENV_FILE}.new" 2>/dev/null && mv "${ENV_FILE}.new" "$ENV_FILE" || true

append_env() {
  echo "${1}=${2}" >>"$ENV_FILE"
}

if [ "$DEPLOY_DB_ENGINE" = "pgsql" ]; then
  echo "==> PostgreSQL : $DB_NAME / $DB_USER"
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | grep -q 1 \
    || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DBPASS';"
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DBPASS';" >/dev/null
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

  append_env DB_CONNECTION pgsql
  append_env DB_HOST 127.0.0.1
  append_env DB_PORT 5432
  append_env DB_DATABASE "$DB_NAME"
  append_env DB_USERNAME "$DB_USER"
  append_env DB_PASSWORD "$DBPASS"
else
  echo "==> MariaDB : $DB_NAME / $DB_USER"
  mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DBPASS';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DBPASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL

  append_env DB_CONNECTION mysql
  append_env DB_HOST 127.0.0.1
  append_env DB_PORT 3306
  append_env DB_DATABASE "$DB_NAME"
  append_env DB_USERNAME "$DB_USER"
  append_env DB_PASSWORD "$DBPASS"
fi

if [ "$DEPLOY_FOR_TESTS" = "1" ]; then
  for kv in "APP_ENV=staging" "APP_DEBUG=true" "APP_URL=https://${PUBLIC_DOMAIN}" "FRONTEND_URL=https://${PUBLIC_DOMAIN}" "SANCTUM_STATEFUL_DOMAINS=${PUBLIC_DOMAIN}"; do
    k="${kv%%=*}"
    grep -v "^${k}=" "$ENV_FILE" >"${ENV_FILE}.new" && mv "${ENV_FILE}.new" "$ENV_FILE"
    echo "$kv" >>"$ENV_FILE"
  done
  echo "==> Mode tests : APP_ENV=staging, APP_DEBUG=true"
else
  for kv in "APP_ENV=production" "APP_DEBUG=false" "APP_URL=https://${PUBLIC_DOMAIN}" "FRONTEND_URL=https://${PUBLIC_DOMAIN}" "SANCTUM_STATEFUL_DOMAINS=${PUBLIC_DOMAIN}"; do
    k="${kv%%=*}"
    grep -v "^${k}=" "$ENV_FILE" >"${ENV_FILE}.new" && mv "${ENV_FILE}.new" "$ENV_FILE"
    echo "$kv" >>"$ENV_FILE"
  done
fi

echo "==> Stack BDD + .env OK ($DEPLOY_DB_ENGINE, domaine $PUBLIC_DOMAIN)"

#!/bin/sh
set -e
cd /var/www/html

# Permissions stockage (utile si volume nommé)
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

# APP_KEY obligatoire en prod : généré une fois si absent (stable tant que le conteneur n'est pas recréé sans volume)
if [ -z "$APP_KEY" ]; then
  export APP_KEY="$(php -r "echo 'base64:'.base64_encode(random_bytes(32));")"
  echo "docker-entrypoint: APP_KEY généré (définissez APP_KEY dans .env.docker pour une clé stable en prod)."
fi

# Attente MySQL
if [ -n "$DB_HOST" ] && [ "$DB_CONNECTION" != "sqlite" ]; then
  echo "Attente de MySQL (${DB_HOST}:3306)…"
  i=0
  while [ "$i" -lt 60 ]; do
    if php -r "
      try {
        new PDO(
          'mysql:host=' . getenv('DB_HOST') . ';port=' . (getenv('DB_PORT') ?: '3306') . ';dbname=' . getenv('DB_DATABASE'),
          getenv('DB_USERNAME'),
          getenv('DB_PASSWORD') ?: '',
          [PDO::ATTR_TIMEOUT => 2]
        );
        exit(0);
      } catch (Throwable \$e) {
        exit(1);
      }
    " 2>/dev/null; then
      echo "MySQL prêt."
      break
    fi
    i=$((i + 1))
    sleep 2
  done
  if [ "$i" -ge 60 ]; then
    echo "MySQL injoignable après 120s."
    exit 1
  fi
fi

php artisan migrate --force --no-interaction
php artisan storage:link --force 2>/dev/null || true

if [ "${RUN_SEED:-0}" = "1" ]; then
  php artisan db:seed --force --no-interaction || true
fi

if [ "${RUN_OPTIMIZE:-1}" = "1" ]; then
  php artisan config:cache --no-interaction || true
  php artisan route:cache --no-interaction || true
  php artisan view:cache --no-interaction || true
fi

exec docker-php-entrypoint php-fpm

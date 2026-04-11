#!/usr/bin/env bash
# Migre et seed la plateforme BTP via Docker (sans PHP installé en local)
# Prérequis : Docker, et .env dans laravel-api avec DB_* pointant vers la base
# (depuis le conteneur : DB_HOST=host.docker.internal si MySQL tourne sur la machine)

set -e
cd "$(dirname "$0")/.."

# Ajouter chemins courants (Docker Desktop sur Mac)
export PATH="/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker n'est pas installé ou pas dans le PATH."
  echo "Installez Docker Desktop ou exécutez : ./scripts/seed-btp.sh (avec PHP installé)."
  exit 1
fi

LARAVEL_DIR="laravel-api"
if [ ! -f "$LARAVEL_DIR/.env" ]; then
  echo "Fichier $LARAVEL_DIR/.env absent. Copiez .env.example vers .env et configurez DB_*."
  exit 1
fi

# Construire l'image pour artisan
echo "Construction de l'image Docker (PHP + artisan)..."
docker build -f "$LARAVEL_DIR/Dockerfile.artisan" -t laravel-artisan "$LARAVEL_DIR"

# Installer les dépendances Composer si besoin
if [ ! -d "$LARAVEL_DIR/vendor" ]; then
  echo "Installation des dépendances Composer..."
  docker run --rm \
    -v "$(pwd)/$LARAVEL_DIR:/app" \
    -w /app \
    laravel-artisan composer install --no-interaction
fi

# Depuis le conteneur, la base est souvent sur l'hôte
export HOST_ENV=""
if grep -q "DB_HOST=127.0.0.1" "$LARAVEL_DIR/.env" 2>/dev/null; then
  echo "DB_HOST=127.0.0.1 détecté : utilisation de host.docker.internal pour le conteneur."
  HOST_ENV="-e DB_HOST=host.docker.internal"
fi

echo "Migrations..."
docker run --rm \
  -v "$(pwd)/$LARAVEL_DIR:/app" \
  -w /app \
  $HOST_ENV \
  --env-file "$LARAVEL_DIR/.env" \
  laravel-artisan php artisan migrate --force

echo "Seed (données de démo + modèles mail)..."
docker run --rm \
  -v "$(pwd)/$LARAVEL_DIR:/app" \
  -w /app \
  $HOST_ENV \
  --env-file "$LARAVEL_DIR/.env" \
  laravel-artisan php artisan db:seed --force

echo "Terminé."
echo "Si vous n'avez pas encore fait : cd $LARAVEL_DIR && composer install (ou lancez le conteneur avec composer)."
echo "Puis démarrez l'API : php artisan serve (ou utilisez votre méthode habituelle)."

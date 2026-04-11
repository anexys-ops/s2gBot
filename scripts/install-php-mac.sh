#!/usr/bin/env bash
# Installe Homebrew (si besoin) puis PHP et Composer pour Laravel.
# À lancer dans le Terminal : ./scripts/install-php-mac.sh
# Tu devras entrer ton mot de passe Mac si Homebrew s’installe.

set -e
cd "$(dirname "$0")/.."

# Mettre Homebrew dans le PATH (au cas où il est installé mais pas dans ce terminal)
if [ -f /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -f /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "=========================================="
echo "  Installation PHP pour Laravel BTP"
echo "=========================================="
echo ""

if command -v php >/dev/null 2>&1 && command -v composer >/dev/null 2>&1; then
  echo "PHP et Composer sont déjà installés :"
  php -v
  composer -V
  echo ""
  echo "Tu peux lancer : ./scripts/seed-btp.sh"
  exit 0
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "1/3 Installation de Homebrew (une seule fois, ~2 min)..."
  echo "    → Le Terminal va demander ton mot de passe Mac."
  echo ""
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Recharger le PATH après l’install
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -f /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  echo ""
else
  echo "1/3 Homebrew est déjà installé."
fi

echo "2/3 Installation de PHP..."
brew install php

echo "3/3 Installation de Composer..."
brew install composer

echo ""
echo "=========================================="
echo "  Installation terminée"
echo "=========================================="
echo ""
php -v
composer -V
echo ""
echo "Prochaine étape (dans ce même terminal) :"
echo "  cd laravel-api"
echo "  composer install"
echo "  cp .env.example .env"
echo "  php artisan key:generate"
echo ""
echo "Édite laravel-api/.env (DB_DATABASE, DB_USERNAME, DB_PASSWORD si tu utilises MySQL)."
echo "Puis lance les migrations et le seed :"
echo "  cd /Users/admin/Documents/s2gBot"
echo "  ./scripts/seed-btp.sh"
echo ""

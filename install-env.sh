#!/usr/bin/env bash
# Installe Homebrew puis Node.js pour faire tourner la plateforme s2gBot.
# À lancer dans le Terminal : ./install-env.sh
# Tu devras entrer ton mot de passe Mac quand demandé.

set -e
cd "$(dirname "$0")"

echo "=========================================="
echo "  Installation de l'environnement s2gBot"
echo "=========================================="
echo ""

if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  echo "Node.js est déjà installé : $(node -v), npm $(npm -v)"
  echo "Tu peux lancer : ./start.sh"
  exit 0
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "1/2 Installation de Homebrew (gestionnaire de paquets Mac)..."
  echo "    → Tu devras entrer ton mot de passe et valider avec Entrée."
  echo ""
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Ajouter brew au PATH (emplacement standard sur Apple Silicon et Intel)
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  echo ""
else
  echo "1/2 Homebrew est déjà installé."
fi

echo "2/2 Installation de Node.js..."
brew install node

echo ""
echo "=========================================="
echo "  Installation terminée"
echo "=========================================="
echo ""
echo "Node : $(node -v)"
echo "npm  : $(npm -v)"
echo ""
echo "Lance la plateforme avec : ./start.sh"
echo ""
